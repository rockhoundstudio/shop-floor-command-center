// ============================================================================
// FILE: app/routes/app.sidekick-queue.jsx
// ROCKHOUND STUDIO — UNIVERSAL SIDEKICK COMMAND & RESEARCH QUEUE
//
// Connected Scope File 3 of 8:
// - Preserves universal Shop Floor Command Center READ + WRITE architecture
//   and keeps the existing "sidekick_queue" table and 30-second tab polling
//   100% intact.
// - Adds zero new side effects or API spending in the GET loader (read-only
//   query inspection for "sidekick_research_request").
// - Separates three distinct events:
//   (1) Sidekick draft preparation in Shopify Admin (never in product fields),
//   (2) Merchant review & Save in Shopify Admin,
//   (3) Explicit Merchant POST "Run Grounded Research" click here.
// - Enforces single-process concurrency lock + claimId write-then-verify
//   hygiene (while stating honestly that multi-worker/restart races are not
//   distributed-atomic without external CAS).
// - Isolates post-Gemini publication failures in bounded server RAM keyed by
//   authenticated shop + metaobject GID so cache republish or Shopify writeback
//   repair NEVER reruns Gemini or trusts client-supplied report payloads.
// ============================================================================

import { randomUUID } from "node:crypto";
import { useEffect } from "react";
import {
  useLoaderData,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import { authenticate } from "../shopify.server";
import {
  executeGroundedGeminiResearch,
  checkGeminiResearchEnvReady,
} from "../utils/gemini-grounded-research.server.js";
import { readTelemetryReport } from "../utils/meta-injector.sidekick-report-cache.server.js";
import SidekickQueueCalmView from "../components/SidekickQueueCalmView.jsx";
import {
  RESEARCH_METAOBJECT_TYPE,
  SAVED_REPORT_FIELD_KEY,
  evaluateResearchRunEligibility,
  publishGroundedResearchToTelemetryCache,
  buildDurableSavedReportEnvelope,
  parseSavedReportField,
  writeAndVerifyDurableResearchReport,
  buildCalmResearchCardModel,
} from "../utils/sidekick-research-storage.server.js";
import {
  getResearchInFlightLockSet,
  buildResearchLockCompositeKey,
} from "../utils/sidekick-research-status.server.js";
const METAOBJECT_GID_REGEX = /^gid:\/\/shopify\/Metaobject\/\d+$/;

const REPAIR_VAULT_GLOBAL_KEY =
  "__ROCKHOUND_SIDEKICK_RESEARCH_REPAIR_VAULT_V1__";

const REPAIR_VAULT_TTL_MS = 30 * 60 * 1000;
const MAX_REPAIR_VAULT_ENTRIES_PER_SHOP = 12;
const MAX_REPAIR_VAULT_ENTRIES_GLOBAL = 48;

const RESEARCH_FIELD_DEFINITIONS = [
  { name: "Request Key", key: "requestKey", type: "single_line_text_field" },
  { name: "Research Query", key: "query", type: "multi_line_text_field" },
  { name: "Constraints", key: "constraints", type: "multi_line_text_field" },
  { name: "Status", key: "status", type: "single_line_text_field" },
  { name: "Claim ID", key: "claimId", type: "single_line_text_field" },
  { name: "Report ID", key: "reportId", type: "single_line_text_field" },
  { name: "Executed At", key: "executedAt", type: "single_line_text_field" },
  {
    name: "Grounding Summary",
    key: "groundingSummary",
    type: "multi_line_text_field",
  },
  { name: "Error Detail", key: "errorDetail", type: "multi_line_text_field" },
  { name: "Saved Report JSON", key: SAVED_REPORT_FIELD_KEY, type: "json" },
];

function getRepairVaultMap() {
  if (!(globalThis[REPAIR_VAULT_GLOBAL_KEY] instanceof Map)) {
    Object.defineProperty(globalThis, REPAIR_VAULT_GLOBAL_KEY, {
      value: new Map(),
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }
  return globalThis[REPAIR_VAULT_GLOBAL_KEY];
}

function purgeExpiredVaultEntries(vault, nowMs = Date.now()) {
  for (const [key, entry] of vault.entries()) {
    if (!entry || entry.expiresAtMs <= nowMs) {
      vault.delete(key);
    }
  }
}

function saveServerRepairEntry({
  shop,
  metaobjectId,
  requestKey,
  query,
  constraints = null,
  researchResult,
  reportId = null,
  cacheStored = false,
  writebackSucceeded = false,
}) {
  const vault = getRepairVaultMap();
  const nowMs = Date.now();
  purgeExpiredVaultEntries(vault, nowMs);

  const normalizedShop = String(shop).trim().toLowerCase();
  const compositeKey = buildCompositeKey(normalizedShop, metaobjectId);

  const shopEntries = [];
  for (const [k, v] of vault.entries()) {
    if (v.shop === normalizedShop && k !== compositeKey) {
      shopEntries.push([k, v]);
    }
  }
  if (shopEntries.length >= MAX_REPAIR_VAULT_ENTRIES_PER_SHOP) {
    shopEntries.sort((a, b) => a[1].storedAtMs - b[1].storedAtMs);
    const removeCount =
      shopEntries.length - MAX_REPAIR_VAULT_ENTRIES_PER_SHOP + 1;
    for (let i = 0; i < removeCount; i += 1) {
      vault.delete(shopEntries[i][0]);
    }
  }

  if (!vault.has(compositeKey) && vault.size >= MAX_REPAIR_VAULT_ENTRIES_GLOBAL) {
    const allEntries = Array.from(vault.entries()).sort(
      (a, b) => a[1].storedAtMs - b[1].storedAtMs
    );
    const removeCount = vault.size - MAX_REPAIR_VAULT_ENTRIES_GLOBAL + 1;
    for (let i = 0; i < removeCount && i < allEntries.length; i += 1) {
      vault.delete(allEntries[i][0]);
    }
  }

  const entry = {
    shop: normalizedShop,
    metaobjectId,
    requestKey: requestKey || null,
    query,
    constraints: constraints || null,
    storedAtMs: nowMs,
    expiresAtMs: nowMs + REPAIR_VAULT_TTL_MS,
    expiresAtIso: new Date(nowMs + REPAIR_VAULT_TTL_MS).toISOString(),
    executedAt: researchResult.executedAt,
    reportObject: researchResult.reportObject || null,
    reportFullTextJson: researchResult.reportFullTextJson,
    usableWebSourceCount: researchResult.usableWebSourceCount || 0,
    usableSupportSpanCount: researchResult.usableSupportSpanCount || 0,
    webSearchQueries: Array.isArray(researchResult.webSearchQueries)
      ? [...researchResult.webSearchQueries]
      : [],
    sources: Array.isArray(researchResult.groundingChunks)
      ? researchResult.groundingChunks
          .filter((c) => c && c.usableWebSource && c.uri)
          .slice(0, 12)
          .map((c) => ({
            chunkIndex: c.chunkIndex,
            title: c.title,
            uri: c.uri,
          }))
      : [],
    searchEntryPointHtml: researchResult.searchEntryPointHtml || null,
    answerPreview:
      typeof researchResult?.reportObject?.modelSynthesisAnswer === "string"
        ? researchResult.reportObject.modelSynthesisAnswer.slice(0, 900)
        : "",
    reportId,
    cacheStored: Boolean(cacheStored),
    writebackSucceeded: Boolean(writebackSucceeded),
  };

  vault.set(compositeKey, entry);
  return entry;
}

function getShopVaultSnapshots(shop) {
  const vault = getRepairVaultMap();
  const nowMs = Date.now();
  purgeExpiredVaultEntries(vault, nowMs);
  const normalizedShop = String(shop || "").trim().toLowerCase();
  const byMetaobjectId = {};

  for (const entry of vault.values()) {
    if (entry.shop !== normalizedShop) {
      continue;
    }
    let cacheCurrentlyReadable = false;
    if (entry.reportId) {
      const check = readTelemetryReport({
        shop: normalizedShop,
        reportId: entry.reportId,
        section: "report",
        view: "chunk",
        chunkIndex: 0,
      });
      cacheCurrentlyReadable = Boolean(check && check.ok === true);
    }

    byMetaobjectId[entry.metaobjectId] = {
      metaobjectId: entry.metaobjectId,
      reportId: entry.reportId,
      executedAt: entry.executedAt,
      expiresAtIso: entry.expiresAtIso,
      cacheStored: entry.cacheStored,
      cacheCurrentlyReadable,
      writebackSucceeded: entry.writebackSucceeded,
      usableWebSourceCount: entry.usableWebSourceCount,
      usableSupportSpanCount: entry.usableSupportSpanCount,
      webSearchQueries: entry.webSearchQueries,
      sources: entry.sources,
      searchEntryPointHtml: entry.searchEntryPointHtml,
      answerPreview: entry.answerPreview,
    };
  }

  return byMetaobjectId;
}

function mapFieldsArrayToObject(fieldsArray) {
  if (!Array.isArray(fieldsArray)) {
    return {};
  }
  const out = {};
  for (let i = 0; i < fieldsArray.length; i += 1) {
    const item = fieldsArray[i];
    if (item && typeof item.key === "string") {
      out[item.key] = item.value ?? "";
    }
  }
  return out;
}

async function readResearchMetaobjectById(admin, metaobjectId) {
  const response = await admin.graphql(
    `#graphql
      query GetResearchRequestById($id: ID!) {
        metaobject(id: $id) {
          id
          type
          updatedAt
          fields {
            key
            value
          }
        }
      }
    `,
    { variables: { id: metaobjectId } }
  );

  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return {
      ok: false,
      message: payload.errors[0]?.message || "GraphQL read failed.",
    };
  }

  const node = payload?.data?.metaobject;
  if (!node || node.type !== RESEARCH_METAOBJECT_TYPE) {
    return {
      ok: false,
      message: `Metaobject ${metaobjectId} was not found or is not type "${RESEARCH_METAOBJECT_TYPE}".`,
    };
  }

  return {
    ok: true,
    id: node.id,
    updatedAt: node.updatedAt || null,
    fields: mapFieldsArrayToObject(node.fields),
  };
}

async function updateResearchMetaobjectFields(admin, metaobjectId, fieldMap) {
  const fieldsInput = [];
  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fieldsInput.push({
        key,
        value: value === null ? "" : String(value),
      });
    }
  }

  const response = await admin.graphql(
    `#graphql
      mutation UpdateResearchRequest($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
            updatedAt
            fields {
              key
              value
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
    {
      variables: {
        id: metaobjectId,
        metaobject: { fields: fieldsInput },
      },
    }
  );

  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return {
      ok: false,
      message: payload.errors[0]?.message || "GraphQL metaobjectUpdate error.",
    };
  }

  const userErrors = payload?.data?.metaobjectUpdate?.userErrors || [];
  if (userErrors.length > 0) {
    return {
      ok: false,
      message: userErrors.map((e) => e.message).join(" | "),
    };
  }

  const updatedNode = payload?.data?.metaobjectUpdate?.metaobject;
  if (!updatedNode) {
    return {
      ok: false,
      message: "metaobjectUpdate returned no updated metaobject.",
    };
  }

  return {
    ok: true,
    fields: mapFieldsArrayToObject(updatedNode.fields),
  };
}

function normalizeResearchStatus(rawStatus) {
  const clean = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
  return clean || "queued";
}

// ==========================================
// 1. ENGINE: FETCH JOBS & READ-ONLY RESEARCH
// ==========================================
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const authenticatedShop = session?.shop?.trim().toLowerCase() || "";

  // Preserve original sidekick_queue setup & query behavior intact
  const setupMutation = `#graphql
    mutation {
      metaobjectDefinitionCreate(definition: {
        name: "Sidekick Queue",
        type: "sidekick_queue",
        access: { admin: "MERCHANT_READ_WRITE" },
        fieldDefinitions: [
          { name: "Product ID", key: "productId", type: "single_line_text_field" },
          { name: "Key", key: "key", type: "single_line_text_field" },
          { name: "Value", key: "value", type: "single_line_text_field" },
          { name: "Status", key: "status", type: "single_line_text_field" }
        ]
      }) { metaobjectDefinition { id } }
    }
  `;
  try {
    await admin.graphql(setupMutation);
  } catch (e) {
    /* Silently ignore if it already exists */
  }

  let jobs = [];
  let queueError = null;

  try {
    const response = await admin.graphql(`#graphql
      query {
        metaobjects(type: "sidekick_queue", first: 20, reverse: true) {
          edges { node { id fields { key value } } }
        }
      }
    `);

    const data = await response.json();
    const edges = data.data?.metaobjects?.edges || [];

    jobs = edges.map((edge) => {
      const fields = edge.node.fields.reduce((acc, field) => {
        acc[field.key] = field.value;
        return acc;
      }, {});
      return {
        id: edge.node.id,
        productId: fields.productId || "N/A",
        targetKey: fields.key || "N/A",
        targetValue: fields.value || "N/A",
        status: fields.status || "pending",
      };
    });
  } catch (error) {
    console.error("Sidekick Queue Loader Error:", error);
    queueError = error.message;
  }

  // Read-only check for sidekick_research_request (ZERO definition writes or API spend in GET)
  let researchDefinitionReady = false;
  let researchDefinitionId = null;
  let researchRequests = [];
  let researchCards = [];
  let researchLoaderError = null;

  const vaultByMetaobjectId = authenticatedShop
    ? getShopVaultSnapshots(authenticatedShop)
    : {};
  const rawVaultMap = getRepairVaultMap();

  try {
    const defResponse = await admin.graphql(
      `#graphql
        query CheckResearchDefinition($type: String!) {
          metaobjectDefinitionByType(type: $type) {
            id
            type
            name
            fieldDefinitions {
              key
            }
          }
        }
      `,
      { variables: { type: RESEARCH_METAOBJECT_TYPE } }
    );
    const defData = await defResponse.json();
    const defNode = defData?.data?.metaobjectDefinitionByType;

    if (defNode && defNode.id) {
      researchDefinitionReady = true;
      researchDefinitionId = defNode.id;

      const reqResponse = await admin.graphql(
        `#graphql
          query ListResearchRequests($type: String!) {
            metaobjects(type: $type, first: 20, reverse: true) {
              edges {
                node {
                  id
                  updatedAt
                  fields {
                    key
                    value
                  }
                }
              }
            }
          }
        `,
        { variables: { type: RESEARCH_METAOBJECT_TYPE } }
      );
      const reqData = await reqResponse.json();
      const reqEdges = reqData?.data?.metaobjects?.edges || [];
      const activeInFlightSet = getResearchInFlightLockSet();

      researchRequests = reqEdges.map((edge) => {
        const f = mapFieldsArrayToObject(edge.node.fields);
        const storedStatus = normalizeResearchStatus(f.status);
        const isInFlightInWorker = Boolean(
          authenticatedShop &&
            activeInFlightSet.has(buildCompositeKey(authenticatedShop, edge.node.id))
        );
        const effectiveRawFields =
          isInFlightInWorker &&
          (storedStatus === "queued" || storedStatus === "failed_pre_dispatch")
            ? { ...f, status: "running" }
            : f;
        const effectiveStatus = normalizeResearchStatus(effectiveRawFields.status);

        const vaultSnap = vaultByMetaobjectId[edge.node.id] || null;
        const rawVaultEntry = authenticatedShop
          ? rawVaultMap.get(buildCompositeKey(authenticatedShop, edge.node.id)) || null
          : null;
        const parsedDurableForId = parseSavedReportField(f[SAVED_REPORT_FIELD_KEY]);
        const durableEnvelopeReportId =
          parsedDurableForId.valid &&
          typeof parsedDurableForId.envelope?.reportId === "string" &&
          parsedDurableForId.envelope.reportId.trim()
            ? parsedDurableForId.envelope.reportId.trim()
            : null;
        const reportId =
          f.reportId?.trim() || durableEnvelopeReportId || vaultSnap?.reportId || null;

        let cacheReadableNow = false;
        if (reportId && authenticatedShop) {
          const check = readTelemetryReport({
            shop: authenticatedShop,
            reportId,
            section: "report",
            view: "chunk",
            chunkIndex: 0,
          });
          cacheReadableNow = Boolean(check && check.ok === true);
        }

        const calmCard = buildCalmResearchCardModel({
          id: edge.node.id,
          updatedAt: edge.node.updatedAt || null,
          rawFields: effectiveRawFields,
          cacheReadableNow,
          vaultSnapshot: vaultSnap,
          fullVaultReportJson: rawVaultEntry?.reportFullTextJson || null,
        });
        researchCards.push(calmCard);

        return {
          id: edge.node.id,
          shortId: edge.node.id.split("/").pop(),
          updatedAt: edge.node.updatedAt || null,
          requestKey: f.requestKey?.trim() || "",
          query: f.query?.trim() || "",
          constraints: f.constraints?.trim() || "",
          status: effectiveStatus,
          storedStatus,
          inFlightInWorker: isInFlightInWorker,
          claimId: f.claimId?.trim() || "",
          reportId,
          executedAt: f.executedAt?.trim() || "",
          groundingSummary: f.groundingSummary?.trim() || "",
          errorDetail: f.errorDetail?.trim() || "",
          cacheReadableNow,
          durablySaved: calmCard.durablySaved,
        };
      });
    }
  } catch (err) {
    researchLoaderError =
      err instanceof Error ? err.message : "Failed to inspect research requests.";
  }

  return Response.json({
    jobs,
    success: !queueError,
    error: queueError,
    researchDefinitionReady,
    researchDefinitionId,
    researchRequests,
    researchCards,
    researchLoaderError,
    vaultByMetaobjectId,
  });
};

// ==========================================
// 2. EXPLICIT MERCHANT POST ACTIONS
// ==========================================
export const action = async ({ request }) => {
  if ((request.method || "").toUpperCase() !== "POST") {
    return Response.json(
      { ok: false, error: "Only POST requests are permitted." },
      { status: 405 }
    );
  }

  const { admin, session } = await authenticate.admin(request);
  const authenticatedShop = session?.shop?.trim().toLowerCase() || "";
  if (!authenticatedShop) {
    return Response.json(
      { ok: false, error: "Missing authenticated shop session." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "").trim();

  // --- INTENT A: EXPLICIT DEFINITION INITIALIZATION / REPAIR ---
  if (intent === "setupResearchDefinition") {
    try {
      const checkRes = await admin.graphql(
        `#graphql
          query CheckExistingResearchDef($type: String!) {
            metaobjectDefinitionByType(type: $type) {
              id
              fieldDefinitions {
                key
              }
            }
          }
        `,
        { variables: { type: RESEARCH_METAOBJECT_TYPE } }
      );
      const checkJson = await checkRes.json();
      const existingDef = checkJson?.data?.metaobjectDefinitionByType;

      if (!existingDef) {
        const createRes = await admin.graphql(
          `#graphql
            mutation CreateResearchMetaobjectDef($definition: MetaobjectDefinitionCreateInput!) {
              metaobjectDefinitionCreate(definition: $definition) {
                metaobjectDefinition {
                  id
                  type
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            variables: {
              definition: {
                name: "Sidekick Research Request",
                type: RESEARCH_METAOBJECT_TYPE,
                access: { admin: "MERCHANT_READ_WRITE" },
                fieldDefinitions: RESEARCH_FIELD_DEFINITIONS,
              },
            },
          }
        );
        const createJson = await createRes.json();
        const userErrors =
          createJson?.data?.metaobjectDefinitionCreate?.userErrors || [];
        if (userErrors.length > 0) {
          return Response.json(
            {
              ok: false,
              intent,
              error: userErrors.map((e) => e.message).join(" | "),
            },
            { status: 400 }
          );
        }
        return Response.json({
          ok: true,
          intent,
          message:
            'Initialized "sidekick_research_request" metaobject definition (MERCHANT_READ_WRITE). Sidekick can now prepare draft research entries for merchant review and Save.',
        });
      }

      const existingKeys = new Set(
        (existingDef.fieldDefinitions || []).map((f) => f.key)
      );
      const missingDefs = RESEARCH_FIELD_DEFINITIONS.filter(
        (f) => !existingKeys.has(f.key)
      );

      if (missingDefs.length > 0) {
        const updateRes = await admin.graphql(
          `#graphql
            mutation EnsureResearchDefFields($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
              metaobjectDefinitionUpdate(id: $id, definition: $definition) {
                metaobjectDefinition {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            variables: {
              id: existingDef.id,
              definition: {
                fieldDefinitions: missingDefs.map((f) => ({ create: f })),
              },
            },
          }
        );
        const updateJson = await updateRes.json();
        const updateErrors =
          updateJson?.data?.metaobjectDefinitionUpdate?.userErrors || [];
        if (updateErrors.length > 0) {
          return Response.json(
            {
              ok: false,
              intent,
              error: updateErrors.map((e) => e.message).join(" | "),
            },
            { status: 400 }
          );
        }
        return Response.json({
          ok: true,
          intent,
          message: `Verified "${RESEARCH_METAOBJECT_TYPE}" definition and added ${missingDefs.length} missing field(s).`,
        });
      }

      return Response.json({
        ok: true,
        intent,
        message: `"${RESEARCH_METAOBJECT_TYPE}" definition is already initialized with all required fields.`,
      });
    } catch (err) {
      return Response.json(
        {
          ok: false,
          intent,
          error:
            err instanceof Error
              ? err.message
              : "Failed to initialize research metaobject definition.",
        },
        { status: 500 }
      );
    }
  }

  // --- INTENT B: EXPLICIT MERCHANT-AUTHORIZED GROUNDED RESEARCH RUN ---
  if (intent === "runResearch") {
    const metaobjectId = String(formData.get("metaobjectId") || "").trim();
    const merchantRunConfirmed =
      String(formData.get("merchantRunConfirmed") || "") === "true";

    if (!merchantRunConfirmed) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId: metaobjectId || null,
          error:
            "Explicit merchant Run confirmation is required before invoking the Gemini API.",
        },
        { status: 400 }
      );
    }

    if (!METAOBJECT_GID_REGEX.test(metaobjectId)) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId: metaobjectId || null,
          error: "Invalid Shopify Metaobject GID.",
        },
        { status: 400 }
      );
    }

    const inFlightSet = getResearchInFlightLockSet();
    const lockKey = buildCompositeKey(authenticatedShop, metaobjectId);
    if (inFlightSet.has(lockKey)) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId,
          status: "running",
          error:
            "This research request is already running in this server worker process. Duplicate run blocked.",
        },
        { status: 409 }
      );
    }

    inFlightSet.add(lockKey);
    try {
      // 1. Fresh server-side Shopify read (never trust prefilled UI state, and never
      // fabricate a stored status when the metaobject read fails or is missing).
      const initialRead = await readResearchMetaobjectById(admin, metaobjectId);
      if (!initialRead.ok) {
        return Response.json(
          {
            ok: false,
            intent,
            metaobjectId,
            status: null,
            error: initialRead.message,
          },
          { status: 404 }
        );
      }

      const fields = initialRead.fields;
      const currentStatus = normalizeResearchStatus(fields.status);
      const existingClaim = (fields.claimId || "").trim();

      // Shared 6-part eligibility contract:
      // Requires status in {"queued", "failed_pre_dispatch"}, empty claimId,
      // empty executedAt, empty reportId, genuinely empty savedReportJson, and
      // passing validateResearchInputs. Any nonempty/invalid savedReportJson or
      // prior claim/execution evidence is strictly non-runnable.
      const eligibility = evaluateResearchRunEligibility(fields);
      if (!eligibility.eligible) {
        if (
          !eligibility.hasExecutionOrSaveEvidence &&
          (currentStatus === "queued" || currentStatus === "failed_pre_dispatch") &&
          !eligibility.inputCheck.ok
        ) {
          const preDispatchWrite = await updateResearchMetaobjectFields(
            admin,
            metaobjectId,
            {
              status: "failed_pre_dispatch",
              errorDetail: `${eligibility.inputCheck.code}: ${eligibility.inputCheck.message}`,
            }
          );
          const confirmedPreStatus = preDispatchWrite.ok
            ? normalizeResearchStatus(preDispatchWrite.fields?.status)
            : null;
          return Response.json(
            {
              ok: false,
              intent,
              metaobjectId,
              executionOutcome: "failed_pre_dispatch",
              status: confirmedPreStatus,
              statusPersisted: Boolean(preDispatchWrite.ok),
              error: `Validation failed before API dispatch (${eligibility.inputCheck.code}): ${eligibility.inputCheck.message}`,
            },
            { status: 400 }
          );
        }

        return Response.json(
          {
            ok: false,
            intent,
            metaobjectId,
            status: currentStatus,
            statusPersisted: true,
            eligibilityCode: eligibility.code,
            error:
              eligibility.code === "saved_report_field_present"
                ? "Request already contains savedReportJson data and is locked against duplicate paid runs."
                : `Request is not eligible for new API spend (status="${currentStatus}", claimId="${existingClaim || "none"}").`,
          },
          { status: 409 }
        );
      }

      const inputCheck = eligibility.inputCheck;

      // Verify server API key readiness BEFORE writing claimId or status="running"
      // so missing environment configuration never bricks an un-dispatched record.
      if (!checkGeminiResearchEnvReady()) {
        return Response.json(
          {
            ok: false,
            intent,
            metaobjectId,
            executionOutcome: "failed_pre_dispatch",
            status: currentStatus,
            statusPersisted: true,
            code: "missing_gemini_api_key",
            error:
              "GEMINI_API_KEY is not configured in server environment variables. Claim was NOT written and no API request was sent.",
          },
          { status: 500 }
        );
      }

      // 2. Claim record BEFORE network call (single-worker lock + claimId re-read check;
      // note: Shopify metaobjectUpdate is not an atomic cross-worker CAS).
      const claimId = `claim_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const claimWrite = await updateResearchMetaobjectFields(
        admin,
        metaobjectId,
        {
          status: "running",
          claimId,
          errorDetail: "",
        }
      );

      if (!claimWrite.ok) {
        return Response.json(
          {
            ok: false,
            intent,
            metaobjectId,
            status: currentStatus,
            statusPersisted: false,
            error: `Aborted before Gemini call: could not write running claim (${claimWrite.message}).`,
          },
          { status: 500 }
        );
      }

      const verifyClaimRead = await readResearchMetaobjectById(
        admin,
        metaobjectId
      );
      if (
        !verifyClaimRead.ok ||
        (verifyClaimRead.fields.claimId || "").trim() !== claimId ||
        normalizeResearchStatus(verifyClaimRead.fields.status) !== "running"
      ) {
        return Response.json(
          {
            ok: false,
            intent,
            metaobjectId,
            status: verifyClaimRead.ok
              ? normalizeResearchStatus(verifyClaimRead.fields.status)
              : null,
            statusPersisted: Boolean(verifyClaimRead.ok),
            error:
              "Aborted before Gemini call: claim verification mismatch detected (concurrent update). No API request was sent.",
          },
          { status: 409 }
        );
      }

      // 3. Execute single bounded grounded Gemini call (ZERO automatic retries)
      const researchResult = await executeGroundedGeminiResearch({
        query: inputCheck.query,
        constraints: inputCheck.constraints,
        requestKey: inputCheck.requestKey,
      });

      if (!researchResult.ok) {
        const executionOutcome =
          researchResult.status === "uncertain_after_dispatch"
            ? "uncertain_no_retry"
            : researchResult.status;

        const failWrite = await updateResearchMetaobjectFields(
          admin,
          metaobjectId,
          {
            status: executionOutcome,
            executedAt: researchResult.executedAt || new Date().toISOString(),
            errorDetail: `[${researchResult.code}] ${researchResult.message}`,
          }
        );

        const statusPersisted = Boolean(
          failWrite.ok &&
            normalizeResearchStatus(failWrite.fields?.status) === executionOutcome
        );
        const confirmedStatus = statusPersisted ? executionOutcome : null;
        const persistenceWarning = statusPersisted
          ? ""
          : ` [Shopify status writeback unconfirmed (${failWrite.message || "update failed"}); record already holds claim ${claimId} and must NOT be retried.]`;

        return Response.json(
          {
            ok: false,
            intent,
            metaobjectId,
            claimId,
            executionOutcome,
            status: confirmedStatus,
            statusPersisted,
            error: `[${researchResult.code}] ${researchResult.message}${persistenceWarning}`,
          },
          { status: 422 }
        );
      }

      // 4. Grounded search succeeded: save server-held repair vault entry FIRST
      // so cache or Shopify writeback issues NEVER require calling Gemini again.
      const vaultEntry = saveServerRepairEntry({
        shop: authenticatedShop,
        metaobjectId,
        requestKey: inputCheck.requestKey,
        query: inputCheck.query,
        constraints: inputCheck.constraints,
        researchResult,
        reportId: null,
        cacheStored: false,
        writebackSucceeded: false,
      });

      const cacheResult = publishGroundedResearchToTelemetryCache({
        shop: authenticatedShop,
        metaobjectId,
        requestKey: inputCheck.requestKey,
        query: inputCheck.query,
        executedAt: researchResult.executedAt,
        reportObject: researchResult.reportObject,
        reportFullTextJson: researchResult.reportFullTextJson,
      });

      const cacheOk = Boolean(cacheResult.ok && cacheResult.reportId);
      const reportId = cacheOk ? cacheResult.reportId : null;

      vaultEntry.reportId = reportId;
      vaultEntry.cacheStored = cacheOk;

      const summaryLine = `Grounded (${researchResult.usableWebSourceCount} web sources, ${researchResult.usableSupportSpanCount} linked model-answer spans; queries: ${researchResult.webSearchQueries.join("; ").slice(0, 260) || "none listed"})`;

      const targetStatus = cacheOk ? "completed" : "completed_cache_failed";
      const targetErrorDetail = cacheOk
        ? ""
        : `RAM cache publication failed (${cacheResult?.code || "unknown"}): ${cacheResult?.message || "Use Reload / Save without re-running Gemini."}`;

      const envelopeResult = buildDurableSavedReportEnvelope({
        metaobjectId,
        requestKey: inputCheck.requestKey,
        query: inputCheck.query,
        constraints: inputCheck.constraints,
        executedAt: researchResult.executedAt,
        reportId,
        reportObject: researchResult.reportObject,
        reportFullTextJson: researchResult.reportFullTextJson,
        searchEntryPointHtml: researchResult.searchEntryPointHtml,
      });

      const durableOutcome = await writeAndVerifyDurableResearchReport({
        admin,
        metaobjectId,
        baseMetadataFields: {
          status: targetStatus,
          reportId: reportId || "",
          executedAt: researchResult.executedAt,
          groundingSummary: summaryLine,
          errorDetail: targetErrorDetail,
        },
        envelopeResult,
        readMetaobjectById: readResearchMetaobjectById,
        updateMetaobjectFields: updateResearchMetaobjectFields,
      });

      vaultEntry.writebackSucceeded = Boolean(durableOutcome.durablySaved);

      const statusPersisted = Boolean(
        durableOutcome.metadataWriteOk && durableOutcome.statusWritten
      );

      if (!durableOutcome.durablySaved || !cacheOk) {
        const notices = [];
        if (!durableOutcome.durablySaved) {
          notices.push(durableOutcome.message);
        }
        if (!cacheOk) {
          notices.push(
            `30-minute Sidekick RAM cache storage failed (${cacheResult?.code || "cache_error"}).`,
          );
        }
        return Response.json({
          ok: true,
          intent,
          warning: true,
          metaobjectId,
          reportId,
          durablySaved: Boolean(durableOutcome.durablySaved),
          executionOutcome: cacheOk ? "completed_unsaved" : "completed_cache_failed",
          status: statusPersisted ? durableOutcome.statusWritten : null,
          statusPersisted,
          message: notices.join(" "),
        });
      }

      return Response.json({
        ok: true,
        intent,
        metaobjectId,
        reportId,
        durablySaved: true,
        executionOutcome: "completed",
        status: durableOutcome.statusWritten || "completed",
        statusPersisted: true,
        message: `Answer saved to Shopify (verified by exact readback) and active in 30-minute Sidekick cache (${reportId}).`,
      });
    } finally {
      inFlightSet.delete(buildResearchLockCompositeKey(authenticatedShop, metaobjectId));
    }
  }

  // --- INTENT C: ZERO-SPEND SERVER-HELD PUBLICATION / WRITEBACK REPAIR ---
  // Uses ONLY verified durable Shopify report JSON or authenticated shop-bound
  // server vault entries; NEVER accepts client-supplied report JSON/HTML, NEVER
  // overwrites mismatched saved reportIds, and NEVER calls Gemini.
  if (intent === "repairPublication") {
    const metaobjectId = String(formData.get("metaobjectId") || "").trim();
    if (!METAOBJECT_GID_REGEX.test(metaobjectId)) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId: metaobjectId || null,
          error: "Invalid Shopify Metaobject GID.",
        },
        { status: 400 }
      );
    }

    const vault = getRepairVaultMap();
    purgeExpiredVaultEntries(vault, Date.now());
    const compositeKey = buildCompositeKey(authenticatedShop, metaobjectId);
    const rawHeldEntry = vault.get(compositeKey);
    const heldEntry =
      rawHeldEntry && rawHeldEntry.shop === authenticatedShop
        ? rawHeldEntry
        : null;

    const currentMeta = await readResearchMetaobjectById(admin, metaobjectId);
    if (!currentMeta.ok) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId,
          status: null,
          error: currentMeta.message,
        },
        { status: 404 }
      );
    }

    const existingFields = currentMeta.fields;
    const currentStatus = normalizeResearchStatus(existingFields.status);
    const parsedExistingSaved = parseSavedReportField(
      existingFields[SAVED_REPORT_FIELD_KEY]
    );

    const existingFieldReportId = (existingFields.reportId || "").trim() || null;
    const existingEnvelopeMetaId =
      parsedExistingSaved.valid &&
      typeof parsedExistingSaved.envelope?.metaobjectId === "string"
        ? parsedExistingSaved.envelope.metaobjectId.trim()
        : "";
    const existingEnvelopeReportId =
      parsedExistingSaved.valid &&
      typeof parsedExistingSaved.envelope?.reportId === "string" &&
      parsedExistingSaved.envelope.reportId.trim()
        ? parsedExistingSaved.envelope.reportId.trim()
        : null;

    if (
      parsedExistingSaved.valid &&
      existingEnvelopeMetaId &&
      existingEnvelopeMetaId !== metaobjectId
    ) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId,
          status: currentStatus,
          statusPersisted: true,
          code: "saved_envelope_metaobject_mismatch",
          error:
            "Saved report envelope metaobjectId does not match this request record. Refusing automatic reload or overwrite; Gemini was NOT called.",
        },
        { status: 409 }
      );
    }

    if (
      parsedExistingSaved.valid &&
      existingFieldReportId &&
      existingEnvelopeReportId &&
      existingFieldReportId !== existingEnvelopeReportId
    ) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId,
          status: currentStatus,
          statusPersisted: true,
          code: "saved_report_id_conflict",
          error: `Saved metadata reportId (${existingFieldReportId}) conflicts with savedReportJson envelope reportId (${existingEnvelopeReportId}). Saved IDs were NOT overwritten and Gemini was NOT called.`,
        },
        { status: 409 }
      );
    }

    const usableExistingSaved =
      parsedExistingSaved.present &&
      parsedExistingSaved.valid &&
      currentStatus !== "completed_unverified_save";

    // Never overwrite a nonempty corrupt/unverified savedReportJson field unless
    // an intact server-RAM vault entry from this worker is available; if neither
    // exists, surface the exact condition honestly.
    if (parsedExistingSaved.present && !usableExistingSaved && !heldEntry) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId,
          status: currentStatus,
          statusPersisted: true,
          code: parsedExistingSaved.code || "unverified_saved_report",
          error:
            "Saved report JSON on this record failed integrity verification and no 30-minute server memory copy remains. Record stays locked against paid reruns; Gemini was NOT called.",
        },
        { status: 409 }
      );
    }

    if (!usableExistingSaved && !heldEntry) {
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId,
          status: currentStatus,
          statusPersisted: true,
          error:
            "No verified saved Shopify report or active 30-minute server memory copy exists for this request. Gemini was NOT called.",
        },
        { status: 404 }
      );
    }

    const expectedDurableReportId = usableExistingSaved
      ? existingEnvelopeReportId || existingFieldReportId || null
      : existingFieldReportId || heldEntry?.reportId || null;

    const sourceReportObject = usableExistingSaved
      ? parsedExistingSaved.reportObject
      : heldEntry.reportObject;
    const sourceReportFullTextJson = usableExistingSaved
      ? parsedExistingSaved.reportFullTextJson
      : heldEntry.reportFullTextJson;
    const sourceRequestKey =
      (existingFields.requestKey || "").trim() ||
      (usableExistingSaved ? parsedExistingSaved.envelope?.requestKey : null) ||
      heldEntry?.requestKey ||
      null;
    const sourceQuery =
      (existingFields.query || "").trim() ||
      (usableExistingSaved ? parsedExistingSaved.envelope?.query : null) ||
      heldEntry?.query ||
      "";
    const sourceConstraints =
      (existingFields.constraints || "").trim() ||
      (usableExistingSaved ? parsedExistingSaved.envelope?.constraints : null) ||
      heldEntry?.constraints ||
      null;
    const sourceExecutedAt =
      (usableExistingSaved ? parsedExistingSaved.envelope?.executedAt : null) ||
      (existingFields.executedAt || "").trim() ||
      heldEntry?.executedAt ||
      null;

    const cacheResult = publishGroundedResearchToTelemetryCache({
      shop: authenticatedShop,
      metaobjectId,
      requestKey: sourceRequestKey,
      query: sourceQuery,
      executedAt: sourceExecutedAt,
      reportObject: sourceReportObject,
      reportFullTextJson: sourceReportFullTextJson,
      expectedReportId: expectedDurableReportId,
    });

    if (!cacheResult.ok) {
      const httpCode =
        cacheResult.code === "republished_report_id_mismatch" ? 409 : 422;
      return Response.json(
        {
          ok: false,
          intent,
          metaobjectId,
          status: currentStatus,
          statusPersisted: true,
          code: cacheResult.code || "cache_reload_failed",
          reportId: cacheResult.reportId || null,
          expectedReportId: cacheResult.expectedReportId || expectedDurableReportId,
          error: `${cacheResult.message || "Sidekick RAM cache reload failed."} Gemini was NOT called.`,
        },
        { status: httpCode }
      );
    }

    const reportId = cacheResult.reportId;
    const resolvedExecutedAt = cacheResult.executedAt;
    if (heldEntry) {
      heldEntry.reportId = reportId;
      heldEntry.cacheStored = true;
    }

    if (usableExistingSaved) {
      if (
        currentStatus === "completed" &&
        existingFieldReportId === reportId &&
        (existingFields.executedAt || "").trim() === resolvedExecutedAt &&
        !(existingFields.errorDetail || "").trim()
      ) {
        return Response.json({
          ok: true,
          intent,
          metaobjectId,
          reportId,
          durablySaved: true,
          executionOutcome: "completed",
          status: "completed",
          statusPersisted: true,
          message: `Reloaded saved answer into 30-minute Sidekick cache (${reportId}) with zero Gemini API calls.`,
        });
      }

      const metaUpdate = await updateResearchMetaobjectFields(
        admin,
        metaobjectId,
        {
          status: "completed",
          reportId,
          executedAt: resolvedExecutedAt,
          errorDetail: "",
        }
      );

      if (!metaUpdate.ok) {
        return Response.json({
          ok: true,
          intent,
          warning: true,
          metaobjectId,
          reportId,
          durablySaved: true,
          executionOutcome: "completed",
          status: currentStatus,
          statusPersisted: false,
          message: `Reloaded saved answer into 30-minute Sidekick cache (${reportId}) with zero API spend, though metadata update returned: ${metaUpdate.message}`,
        });
      }

      return Response.json({
        ok: true,
        intent,
        metaobjectId,
        reportId,
        durablySaved: true,
        executionOutcome: "completed",
        status: "completed",
        statusPersisted: true,
        message: `Reloaded saved answer into 30-minute Sidekick cache (${reportId}) with zero Gemini API calls.`,
      });
    }

    const summaryLine = `Grounded (${heldEntry.usableWebSourceCount} web sources, ${heldEntry.usableSupportSpanCount} linked model-answer spans; queries: ${heldEntry.webSearchQueries.join("; ").slice(0, 260) || "none listed"})`;

    const envelopeResult = buildDurableSavedReportEnvelope({
      metaobjectId,
      requestKey: sourceRequestKey,
      query: sourceQuery,
      constraints: sourceConstraints,
      executedAt: resolvedExecutedAt,
      reportId,
      reportObject: heldEntry.reportObject,
      reportFullTextJson: heldEntry.reportFullTextJson,
      searchEntryPointHtml: heldEntry.searchEntryPointHtml,
    });

    const durableOutcome = await writeAndVerifyDurableResearchReport({
      admin,
      metaobjectId,
      baseMetadataFields: {
        status: "completed",
        reportId,
        executedAt: resolvedExecutedAt,
        groundingSummary: summaryLine,
        errorDetail: "",
      },
      envelopeResult,
      readMetaobjectById: readResearchMetaobjectById,
      updateMetaobjectFields: updateResearchMetaobjectFields,
    });

    heldEntry.writebackSucceeded = Boolean(durableOutcome.durablySaved);

    const statusPersisted = Boolean(
      durableOutcome.metadataWriteOk && durableOutcome.statusWritten
    );

    if (!durableOutcome.durablySaved) {
      return Response.json({
        ok: true,
        intent,
        warning: true,
        metaobjectId,
        reportId,
        durablySaved: false,
        executionOutcome: "completed_unsaved",
        status: statusPersisted ? durableOutcome.statusWritten : currentStatus,
        statusPersisted,
        message: `Reloaded 30-minute Sidekick cache (${reportId}) with zero API spend, but durable Shopify save is still pending: ${durableOutcome.message}`,
      });
    }

    return Response.json({
      ok: true,
      intent,
      metaobjectId,
      reportId,
      durablySaved: true,
      executionOutcome: "completed",
      status: durableOutcome.statusWritten || "completed",
      statusPersisted: true,
      message: `Answer saved to Shopify (verified by exact readback) and reloaded into 30-minute Sidekick cache (${reportId}) with zero Gemini API calls.`,
    });
  }

  return Response.json(
    { ok: false, error: `Unsupported action intent "${intent}".` },
    { status: 400 }
  );
};

// ==========================================
// 3. CHASSIS: CALM DYSLEXIA-FRIENDLY UI VIEW
// ==========================================
export default function SidekickQueueTab() {
  const {
    jobs = [],
    error,
    researchDefinitionReady = false,
    researchCards = [],
    researchLoaderError = null,
  } = useLoaderData();

  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { revalidate, state } = useRevalidator();

  const isSubmittingAction = fetcher.state !== "idle";
  const submittingIntent =
    isSubmittingAction && fetcher.formData
      ? String(fetcher.formData.get("intent") || "").trim() || null
      : null;
  const submittingMetaobjectId =
    isSubmittingAction && fetcher.formData
      ? String(fetcher.formData.get("metaobjectId") || "").trim() || null
      : null;
  const actionData = fetcher.data;

  // Auto-refresh every 30 seconds ONLY while this tab stays open and idle
  useEffect(() => {
    const interval = setInterval(() => {
      if (state === "idle" && fetcher.state === "idle") {
        revalidate();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [state, fetcher.state, revalidate]);

  const handleSetupDefinition = () => {
    fetcher.submit({ intent: "setupResearchDefinition" }, { method: "post" });
  };

  const handleRunResearch = (metaobjectId) => {
    fetcher.submit(
      {
        intent: "runResearch",
        metaobjectId,
        merchantRunConfirmed: "true",
      },
      { method: "post" }
    );
  };

  const handleRepairPublication = (metaobjectId) => {
    fetcher.submit(
      {
        intent: "repairPublication",
        metaobjectId,
      },
      { method: "post" }
    );
  };

  return (
    <SidekickQueueCalmView
      researchDefinitionReady={researchDefinitionReady}
      researchCards={researchCards}
      jobs={jobs}
      queueError={error}
      researchLoaderError={researchLoaderError}
      actionData={actionData}
      revalidatorState={state}
      isSubmittingAction={isSubmittingAction}
      submittingIntent={submittingIntent}
      submittingMetaobjectId={submittingMetaobjectId}
      onNavigateBack={() => navigate("/")}
      onRefresh={() => revalidate()}
      onSetupDefinition={handleSetupDefinition}
      onRunResearch={handleRunResearch}
      onRepairOrRepublish={handleRepairPublication}
    />
  );
}
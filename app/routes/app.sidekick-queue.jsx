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
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Badge,
  IndexTable,
  Box,
  InlineStack,
  EmptySearchResult,
  Banner,
  Button,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  executeGroundedGeminiResearch,
  validateResearchInputs,
  GEMINI_GROUNDED_RESEARCH_MODE,
} from "../utils/gemini-grounded-research.server.js";
import {
  storeTelemetryReport,
  readTelemetryReport,
} from "../utils/meta-injector.sidekick-report-cache.server.js";

const RESEARCH_METAOBJECT_TYPE = "sidekick_research_request";
const METAOBJECT_GID_REGEX = /^gid:\/\/shopify\/Metaobject\/\d+$/;

const IN_FLIGHT_GLOBAL_KEY =
  "__ROCKHOUND_SIDEKICK_RESEARCH_IN_FLIGHT_LOCKS_V1__";
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
];

function getInFlightSet() {
  if (!(globalThis[IN_FLIGHT_GLOBAL_KEY] instanceof Set)) {
    Object.defineProperty(globalThis, IN_FLIGHT_GLOBAL_KEY, {
      value: new Set(),
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }
  return globalThis[IN_FLIGHT_GLOBAL_KEY];
}

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

function buildCompositeKey(shop, metaobjectId) {
  return `${String(shop).trim().toLowerCase()}::${String(metaobjectId).trim()}`;
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
    storedAtMs: nowMs,
    expiresAtMs: nowMs + REPAIR_VAULT_TTL_MS,
    expiresAtIso: new Date(nowMs + REPAIR_VAULT_TTL_MS).toISOString(),
    executedAt: researchResult.executedAt,
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

function publishResearchToTelemetryCache({
  shop,
  metaobjectId,
  requestKey,
  query,
  executedAt,
  reportFullTextJson,
}) {
  const nowIso = new Date().toISOString();
  const capturedMs = Date.parse(executedAt || "");
  const effectiveCapturedAt =
    Number.isFinite(capturedMs) && Date.now() - capturedMs < 25 * 60 * 1000
      ? executedAt
      : nowIso;

  const shortTitle =
    query.length > 120 ? `${query.slice(0, 117)}...` : query;

  return storeTelemetryReport({
    shop,
    packet: {
      productId: null,
      mode: GEMINI_GROUNDED_RESEARCH_MODE,
      sectionKey: "public_web_grounded_research",
      sectionLabel: "GEMINI GROUNDED PUBLIC WEB RESEARCH",
      productTitle: shortTitle,
      runIdentity: requestKey
        ? `${requestKey} (${metaobjectId.split("/").pop()})`
        : metaobjectId,
      runTimestamp: executedAt || effectiveCapturedAt,
      capturedAt: effectiveCapturedAt,
      fullText: reportFullTextJson,
    },
    uiAudit: null,
  });
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
  let researchLoaderError = null;

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

      researchRequests = reqEdges.map((edge) => {
        const f = mapFieldsArrayToObject(edge.node.fields);
        const normalizedStatus = normalizeResearchStatus(f.status);
        const reportId = f.reportId?.trim() || null;

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

        return {
          id: edge.node.id,
          shortId: edge.node.id.split("/").pop(),
          updatedAt: edge.node.updatedAt || null,
          requestKey: f.requestKey?.trim() || "",
          query: f.query?.trim() || "",
          constraints: f.constraints?.trim() || "",
          status: normalizedStatus,
          claimId: f.claimId?.trim() || "",
          reportId,
          executedAt: f.executedAt?.trim() || "",
          groundingSummary: f.groundingSummary?.trim() || "",
          errorDetail: f.errorDetail?.trim() || "",
          cacheReadableNow,
        };
      });
    }
  } catch (err) {
    researchLoaderError =
      err instanceof Error ? err.message : "Failed to inspect research requests.";
  }

  const vaultByMetaobjectId = authenticatedShop
    ? getShopVaultSnapshots(authenticatedShop)
    : {};

  return Response.json({
    jobs,
    success: !queueError,
    error: queueError,
    researchDefinitionReady,
    researchDefinitionId,
    researchRequests,
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
          error: "Invalid Shopify Metaobject GID.",
        },
        { status: 400 }
      );
    }

    const inFlightSet = getInFlightSet();
    const lockKey = buildCompositeKey(authenticatedShop, metaobjectId);
    if (inFlightSet.has(lockKey)) {
      return Response.json(
        {
          ok: false,
          intent,
          error:
            "This research request is already running in this server worker process. Duplicate run blocked.",
        },
        { status: 409 }
      );
    }

    inFlightSet.add(lockKey);
    try {
      // 1. Fresh server-side Shopify read (never trust prefilled UI state)
      const initialRead = await readResearchMetaobjectById(admin, metaobjectId);
      if (!initialRead.ok) {
        return Response.json(
          { ok: false, intent, error: initialRead.message },
          { status: 404 }
        );
      }

      const fields = initialRead.fields;
      const currentStatus = normalizeResearchStatus(fields.status);
      const existingClaim = (fields.claimId || "").trim();
      const existingExecutedAt = (fields.executedAt || "").trim();
      const existingReportId = (fields.reportId || "").trim();

      if (
        currentStatus !== "queued" ||
        existingClaim !== "" ||
        existingExecutedAt !== "" ||
        existingReportId !== ""
      ) {
        return Response.json(
          {
            ok: false,
            intent,
            error: `Request is not eligible for new API spend (status="${currentStatus}", claimId="${existingClaim || "none"}"). Only untouched "queued" records can be dispatched.`,
          },
          { status: 409 }
        );
      }

      const inputCheck = validateResearchInputs({
        query: fields.query || "",
        constraints: fields.constraints || null,
        requestKey: fields.requestKey || null,
      });
      if (!inputCheck.ok) {
        await updateResearchMetaobjectFields(admin, metaobjectId, {
          status: "failed_pre_dispatch",
          errorDetail: `${inputCheck.code}: ${inputCheck.message}`,
        });
        return Response.json(
          {
            ok: false,
            intent,
            error: `Validation failed before API dispatch (${inputCheck.code}): ${inputCheck.message}`,
          },
          { status: 400 }
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
        const mappedStatus =
          researchResult.status === "uncertain_after_dispatch"
            ? "uncertain_no_retry"
            : researchResult.status;

        await updateResearchMetaobjectFields(admin, metaobjectId, {
          status: mappedStatus,
          executedAt: researchResult.executedAt || new Date().toISOString(),
          errorDetail: `[${researchResult.code}] ${researchResult.message}`,
        });

        return Response.json(
          {
            ok: false,
            intent,
            status: mappedStatus,
            error: `[${researchResult.code}] ${researchResult.message}`,
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
        researchResult,
        reportId: null,
        cacheStored: false,
        writebackSucceeded: false,
      });

      const cacheResult = publishResearchToTelemetryCache({
        shop: authenticatedShop,
        metaobjectId,
        requestKey: inputCheck.requestKey,
        query: inputCheck.query,
        executedAt: researchResult.executedAt,
        reportFullTextJson: researchResult.reportFullTextJson,
      });

      const cacheOk = Boolean(
        cacheResult && cacheResult.ok === true && cacheResult.report?.reportId
      );
      const reportId = cacheOk ? cacheResult.report.reportId : null;

      vaultEntry.reportId = reportId;
      vaultEntry.cacheStored = cacheOk;

      const summaryLine = `Grounded (${researchResult.usableWebSourceCount} web sources, ${researchResult.usableSupportSpanCount} linked model-answer spans; queries: ${researchResult.webSearchQueries.join("; ").slice(0, 260) || "none listed"})`;

      const targetStatus = cacheOk ? "completed" : "completed_cache_failed";
      const targetErrorDetail = cacheOk
        ? ""
        : `RAM cache publication failed (${cacheResult?.code || "unknown"}): ${cacheResult?.message || "Use Repair Publication without re-running Gemini."}`;

      const finalWrite = await updateResearchMetaobjectFields(
        admin,
        metaobjectId,
        {
          status: targetStatus,
          reportId: reportId || "",
          executedAt: researchResult.executedAt,
          groundingSummary: summaryLine,
          errorDetail: targetErrorDetail,
        }
      );

      vaultEntry.writebackSucceeded = finalWrite.ok;

      if (!finalWrite.ok) {
        return Response.json({
          ok: true,
          intent,
          warning: true,
          metaobjectId,
          reportId,
          status: "completed_writeback_failed",
          message: `Grounded search succeeded${reportId ? ` and cached as ${reportId}` : ""}, but Shopify metaobject writeback failed (${finalWrite.message}). Use "Repair Publication (Zero API Spend)" below—do NOT re-run Gemini.`,
        });
      }

      if (!cacheOk) {
        return Response.json({
          ok: true,
          intent,
          warning: true,
          metaobjectId,
          reportId: null,
          status: "completed_cache_failed",
          message: `Grounded search succeeded, but RAM cache storage failed (${cacheResult?.code || "cache_error"}). Use "Repair Publication (Zero API Spend)" if eligible.`,
        });
      }

      return Response.json({
        ok: true,
        intent,
        metaobjectId,
        reportId,
        status: "completed",
        message: `Grounded research completed and published to RAM cache (${reportId}). Sidekick can now retrieve mode="${GEMINI_GROUNDED_RESEARCH_MODE}" for the next 30 minutes.`,
      });
    } finally {
      inFlightSet.delete(lockKey);
    }
  }

  // --- INTENT C: ZERO-SPEND SERVER-HELD PUBLICATION / WRITEBACK REPAIR ---
  // Uses ONLY authenticated shop-bound server vault entries; NEVER accepts
  // client-supplied report JSON/HTML and NEVER calls Gemini.
  if (intent === "repairPublication") {
    const metaobjectId = String(formData.get("metaobjectId") || "").trim();
    if (!METAOBJECT_GID_REGEX.test(metaobjectId)) {
      return Response.json(
        { ok: false, intent, error: "Invalid Shopify Metaobject GID." },
        { status: 400 }
      );
    }

    const vault = getRepairVaultMap();
    purgeExpiredVaultEntries(vault, Date.now());
    const compositeKey = buildCompositeKey(authenticatedShop, metaobjectId);
    const heldEntry = vault.get(compositeKey);

    if (!heldEntry || heldEntry.shop !== authenticatedShop) {
      return Response.json(
        {
          ok: false,
          intent,
          error:
            "No active server-held result exists in this worker process for this request (expired after 30 minutes or process restarted). Gemini was NOT called.",
        },
        { status: 404 }
      );
    }

    const cacheResult = publishResearchToTelemetryCache({
      shop: authenticatedShop,
      metaobjectId,
      requestKey: heldEntry.requestKey,
      query: heldEntry.query,
      executedAt: heldEntry.executedAt,
      reportFullTextJson: heldEntry.reportFullTextJson,
    });

    const cacheOk = Boolean(
      cacheResult && cacheResult.ok === true && cacheResult.report?.reportId
    );
    if (!cacheOk) {
      return Response.json(
        {
          ok: false,
          intent,
          error: `RAM cache republication failed (${cacheResult?.code || "error"}): ${cacheResult?.message || "Unknown cache error"}. Gemini was NOT called.`,
        },
        { status: 422 }
      );
    }

    const reportId = cacheResult.report.reportId;
    heldEntry.reportId = reportId;
    heldEntry.cacheStored = true;

    const summaryLine = `Grounded (${heldEntry.usableWebSourceCount} web sources, ${heldEntry.usableSupportSpanCount} linked model-answer spans; queries: ${heldEntry.webSearchQueries.join("; ").slice(0, 260) || "none listed"})`;

    const writeRes = await updateResearchMetaobjectFields(admin, metaobjectId, {
      status: "completed",
      reportId,
      executedAt: heldEntry.executedAt,
      groundingSummary: summaryLine,
      errorDetail: "",
    });

    heldEntry.writebackSucceeded = writeRes.ok;

    if (!writeRes.ok) {
      return Response.json({
        ok: true,
        intent,
        warning: true,
        reportId,
        message: `RAM cache republished (${reportId}) with ZERO Gemini spend, but Shopify metaobject update still failed (${writeRes.message}). Sidekick can still read ${reportId} from RAM now.`,
      });
    }

    return Response.json({
      ok: true,
      intent,
      reportId,
      message: `Repaired RAM cache publication and Shopify writeback (${reportId}) with ZERO Gemini API calls.`,
    });
  }

  return Response.json(
    { ok: false, error: `Unsupported action intent "${intent}".` },
    { status: 400 }
  );
};

// ==========================================
// 3. CHASSIS: UI DASHBOARD
// ==========================================
function renderResearchStatusBadge(status, cacheReadableNow) {
  if (status === "completed") {
    return (
      <Badge tone={cacheReadableNow ? "success" : "attention"}>
        {cacheReadableNow ? "COMPLETED (IN RAM)" : "COMPLETED (RAM EXPIRED)"}
      </Badge>
    );
  }
  if (status === "queued") {
    return <Badge tone="warning">QUEUED (AWAITING RUN)</Badge>;
  }
  if (status === "running") {
    return <Badge tone="info">RUNNING</Badge>;
  }
  if (
    status === "completed_writeback_failed" ||
    status === "completed_cache_failed"
  ) {
    return <Badge tone="warning">{status.toUpperCase()}</Badge>;
  }
  return <Badge tone="critical">{status.toUpperCase()}</Badge>;
}

export default function SidekickQueueTab() {
  const {
    jobs = [],
    error,
    researchDefinitionReady = false,
    researchRequests = [],
    researchLoaderError = null,
    vaultByMetaobjectId = {},
  } = useLoaderData();

  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { revalidate, state } = useRevalidator();

  const isSubmittingAction = fetcher.state !== "idle";
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

  const rowMarkup = jobs.map((job, index) => (
    <IndexTable.Row id={job.id} key={job.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {job.id.split("/").pop()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{job.productId.split("/").pop()}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {job.targetKey}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{job.targetValue}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge
          tone={
            job.status === "pending"
              ? "warning"
              : job.status === "complete"
                ? "success"
                : "critical"
          }
        >
          {job.status.toUpperCase()}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Sidekick Command Queue"
      subtitle="Universal Command Center queue for reviewed Sidekick jobs and bounded Gemini grounded web research."
      fullWidth
      backAction={{ content: "Tools Launcher", onAction: () => navigate("/") }}
    >
      <BlockStack gap="600">
        {error && <Banner tone="critical">{error}</Banner>}
        {researchLoaderError && (
          <Banner tone="critical">{researchLoaderError}</Banner>
        )}

        {actionData?.error && (
          <Banner tone="critical" title="Action blocked or failed">
            <Text as="p">{actionData.error}</Text>
          </Banner>
        )}

        {actionData?.ok && actionData?.message && (
          <Banner
            tone={actionData.warning ? "warning" : "success"}
            title={
              actionData.warning
                ? "Completed with publication notice"
                : "Action completed"
            }
          >
            <Text as="p">{actionData.message}</Text>
          </Banner>
        )}

        <Banner
          tone="info"
          title="Operating & Volatility Boundaries (Honest Runtime Rules)"
        >
          <BlockStack gap="100">
            <Text as="p" variant="bodySm">
              1. Three Separate Steps: Sidekick prepares a draft{" "}
              <strong>sidekick_research_request</strong> entry (never in product
              fields) → Bob reviews and clicks <strong>Save</strong> in Shopify
              Admin → Bob clicks <strong>Run Grounded Research</strong> here to
              authorize 1 bounded Gemini 2.5 Flash Google-Search call.
            </Text>
            <Text as="p" variant="bodySm">
              2. Tab-Open Polling & RAM Cache Limits: Auto-refresh runs every 30
              seconds ONLY while this browser tab stays open. Published reports
              live in server process RAM for <strong>30 minutes</strong> and do
              not persist across Render restarts or separate worker instances.
              Single-process locks prevent duplicate clicks here, though
              multi-worker deployments do not have distributed CAS locking. No
              automatic retries occur after uncertain network/timeout states.
            </Text>
          </BlockStack>
        </Banner>

        {/* SECTION A: GROUNDED PUBLIC-INTERNET RESEARCH BRIDGE */}
        <Layout>
          <Layout.Section>
            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">
                      Grounded Public-Internet Research Requests (
                      {RESEARCH_METAOBJECT_TYPE})
                    </Text>
                    <Text tone="subdued" as="span">
                      Sourced findings publish to{" "}
                      <code>mode=&quot;gemini_grounded_research&quot;</code> for
                      direct Sidekick report-reader retrieval without manual
                      copy-paste.
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Button
                      onClick={() => revalidate()}
                      disabled={state !== "idle" || isSubmittingAction}
                    >
                      Refresh Now
                    </Button>
                    <Button
                      variant={researchDefinitionReady ? "secondary" : "primary"}
                      loading={isSubmittingAction}
                      onClick={handleSetupDefinition}
                    >
                      {researchDefinitionReady
                        ? "Verify Research Definition"
                        : "Initialize Research Definition"}
                    </Button>
                  </InlineStack>
                </InlineStack>

                <Divider />

                {!researchDefinitionReady && (
                  <Banner
                    tone="warning"
                    title="Research request definition not initialized yet"
                  >
                    <Text as="p">
                      Click <strong>Initialize Research Definition</strong>{" "}
                      above once to create the{" "}
                      <code>sidekick_research_request</code> metaobject
                      definition in Shopify Admin (no GET-loader write side
                      effects).
                    </Text>
                  </Banner>
                )}

                {researchDefinitionReady && researchRequests.length === 0 && (
                  <Box padding="600">
                    <EmptySearchResult
                      title="No saved research requests yet"
                      description='Ask Sidekick to prepare a new "sidekick_research_request" metaobject entry with status="queued" and your query, review and Save it in Shopify Admin, then click Run Grounded Research here.'
                      withIllustration
                    />
                  </Box>
                )}

                {researchRequests.length > 0 && (
                  <BlockStack gap="400">
                    {researchRequests.map((reqItem) => {
                      const vaultSnap = vaultByMetaobjectId[reqItem.id] || null;
                      const isEligibleToRun =
                        reqItem.status === "queued" &&
                        !reqItem.claimId &&
                        !reqItem.executedAt &&
                        !reqItem.reportId;

                      const canRepairFromServerVault = Boolean(
                        vaultSnap &&
                          (!reqItem.cacheReadableNow ||
                            reqItem.status === "completed_writeback_failed" ||
                            reqItem.status === "completed_cache_failed" ||
                            !reqItem.reportId)
                      );

                      return (
                        <Box
                          key={reqItem.id}
                          padding="400"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <BlockStack gap="300">
                            <InlineStack
                              align="space-between"
                              blockAlign="center"
                              wrap
                            >
                              <InlineStack gap="200" blockAlign="center">
                                <Text
                                  variant="bodyMd"
                                  fontWeight="bold"
                                  as="span"
                                >
                                  #{reqItem.shortId}
                                </Text>
                                {reqItem.requestKey && (
                                  <Badge tone="info">{reqItem.requestKey}</Badge>
                                )}
                                {renderResearchStatusBadge(
                                  reqItem.status,
                                  reqItem.cacheReadableNow
                                )}
                              </InlineStack>

                              <InlineStack gap="200">
                                {isEligibleToRun && (
                                  <Button
                                    variant="primary"
                                    tone="success"
                                    loading={isSubmittingAction}
                                    onClick={() =>
                                      handleRunResearch(reqItem.id)
                                    }
                                  >
                                    Run Grounded Research (1 API Call)
                                  </Button>
                                )}

                                {canRepairFromServerVault && (
                                  <Button
                                    variant="primary"
                                    loading={isSubmittingAction}
                                    onClick={() =>
                                      handleRepairPublication(reqItem.id)
                                    }
                                  >
                                    Repair Publication (Zero API Spend)
                                  </Button>
                                )}
                              </InlineStack>
                            </InlineStack>

                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="semibold" as="p">
                                Query: {reqItem.query || "(Empty query)"}
                              </Text>
                              {reqItem.constraints && (
                                <Text variant="bodySm" tone="subdued" as="p">
                                  Constraints: {reqItem.constraints}
                                </Text>
                              )}
                            </BlockStack>

                            {(reqItem.reportId || reqItem.executedAt) && (
                              <InlineStack gap="400" wrap>
                                {reqItem.reportId && (
                                  <Text variant="bodySm" as="span">
                                    <strong>Report ID:</strong>{" "}
                                    <code>{reqItem.reportId}</code>
                                  </Text>
                                )}
                                {reqItem.executedAt && (
                                  <Text variant="bodySm" tone="subdued" as="span">
                                    Executed: {reqItem.executedAt}
                                  </Text>
                                )}
                              </InlineStack>
                            )}

                            {reqItem.groundingSummary && (
                              <Text variant="bodySm" tone="subdued" as="p">
                                {reqItem.groundingSummary}
                              </Text>
                            )}

                            {reqItem.errorDetail && (
                              <Banner tone="critical">
                                <Text variant="bodySm" as="p">
                                  {reqItem.errorDetail}
                                </Text>
                              </Banner>
                            )}

                            {vaultSnap && (
                              <Box
                                padding="300"
                                background="bg-surface"
                                borderRadius="150"
                              >
                                <BlockStack gap="200">
                                  <Text
                                    variant="bodySm"
                                    fontWeight="semibold"
                                    as="p"
                                  >
                                    Active Server-RAM Evidence Preview (Untrusted
                                    Web Evidence — Model Spans Are NOT Verbatim
                                    Source Quotes)
                                  </Text>

                                  {vaultSnap.answerPreview && (
                                    <Text variant="bodySm" as="p">
                                      {vaultSnap.answerPreview}
                                      {vaultSnap.answerPreview.length >= 900
                                        ? "..."
                                        : ""}
                                    </Text>
                                  )}

                                  {vaultSnap.sources?.length > 0 && (
                                    <BlockStack gap="100">
                                      <Text
                                        variant="bodySm"
                                        fontWeight="semibold"
                                        as="p"
                                      >
                                        Cited Web Sources:
                                      </Text>
                                      {vaultSnap.sources.map((src) => (
                                        <Text
                                          key={`${reqItem.id}_src_${src.chunkIndex}`}
                                          variant="bodySm"
                                          as="p"
                                        >
                                          [{src.chunkIndex}]{" "}
                                          <a
                                            href={src.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            {src.title}
                                          </a>
                                        </Text>
                                      ))}
                                    </BlockStack>
                                  )}

                                  {vaultSnap.searchEntryPointHtml && (
                                    <BlockStack gap="100">
                                      <Text
                                        variant="bodySm"
                                        tone="subdued"
                                        as="p"
                                      >
                                        Google Search Suggestions (sandboxed):
                                      </Text>
                                      <iframe
                                        title={`Google Search Suggestions ${reqItem.shortId}`}
                                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                                        referrerPolicy="no-referrer"
                                        srcDoc={vaultSnap.searchEntryPointHtml}
                                        style={{
                                          width: "100%",
                                          minHeight: "76px",
                                          border: "1px solid #dfe3e8",
                                          borderRadius: "8px",
                                          background: "#ffffff",
                                        }}
                                      />
                                    </BlockStack>
                                  )}
                                </BlockStack>
                              </Box>
                            )}
                          </BlockStack>
                        </Box>
                      );
                    })}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* SECTION B: EXISTING PRODUCT METADATA QUEUE (PRESERVED INTACT) */}
        <Layout>
          <Layout.Section>
            <Card padding="0">
              <Box padding="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">
                      Rockhound Studio - Job Queue
                    </Text>
                    <Text tone="subdued" as="span">
                      Auto-refreshes every 30 seconds while tab is open.
                    </Text>
                  </BlockStack>
                  <Badge tone={state === "loading" ? "info" : "success"}>
                    {state === "loading" ? "Syncing..." : "Live"}
                  </Badge>
                </InlineStack>
              </Box>

              {jobs.length === 0 && (
                <Box padding="800">
                  <EmptySearchResult
                    title="Waiting for Sidekick..."
                    description="No jobs in the queue yet. The database is linked and standing by."
                    withIllustration
                  />
                </Box>
              )}

              {jobs.length > 0 && (
                <IndexTable
                  resourceName={{ singular: "job", plural: "jobs" }}
                  itemCount={jobs.length}
                  selectable={false}
                  headings={[
                    { title: "Job ID" },
                    { title: "Product ID" },
                    { title: "Metafield" },
                    { title: "Value" },
                    { title: "Status" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
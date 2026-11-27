# Command Center: Read-Only Report & Request Status Tools

## Tool Scope
- `list_meta_injector_reports` and `read_meta_injector_report` retrieve captured read-only Command Center reports when callable; they do not load manifests/products, run captures/scans/research, record approvals, repair/save, upload files, or publish/delete data.
- `get_sidekick_research_request_status` reads one `sidekick_research_request` record's saved metadata/presence flags, eligibility evaluation, `localProcessLock` (`single_process_ram_only`), `answerAvailability` metadata, and `observedAt` without executing research, hydrating reports, reading answer bodies, calling providers, or mutating records.
- `gemini_grounded_research` reports come from completed `/app/sidekick-queue` runs published into the authenticated 30-minute process RAM cache; these read-only tools do not execute research, forward local files/snapshots to Gemini, or recover durable process loss.
- Working-tree tool/route code does not prove a capability is deployed, callable, or runtime-verified. Do not turn this status tool into a blanket read-only redesign or new approval gate for unrelated app actions.

## Tools
`list_meta_injector_reports` optional params: `productId` (`^gid://shopify/Product/\d+$`), `mode` (1-120 chars: `live_bench_state`, `theme_editor_readback`, `gemini_grounded_research`), `limit` (1-5, default 3), `afterReportId`. Omit `productId` for product-free research; `productId` filter excludes null-`productId` records. Follow `pagination.nextAfterReportId` while `pagination.hasNextPage=true` using only returned IDs/cursors.

`read_meta_injector_report` requires `reportId`. Optional params: `section`: `report` (default) or `ui_audit`; `view`: `chunk` (default), `index`, `header`, `review`, `drawer`, `field`; `chunkIndex`: integer >=0, default 0. `view=drawer` requires exact `drawer`; `view=field` requires exact `fieldKey`; omit unused selectors. Organized views apply only to `live_bench_state`; other modes and `ui_audit` use `view=chunk` (or omit `view`).

`get_sidekick_research_request_status` requires `metaobjectId` (`^gid://shopify/Metaobject/\d+$`). Optional param: `requestKey` (1-160 chars; cross-checked against saved `requestKey` when both are non-empty).

## Shared Rules
- Start chunks at `0`; follow `nextChunkIndex` while `hasMoreChunks=true` with identical `reportId`, `section`, `view`, `drawer`, and `fieldKey`. Join chunk text losslessly before JSON parsing.
- Keep `product`, `theme`, `file`, `reportId`, `session`, and `revision` distinct across snapshots, reports, and views. Historical/manual/superseded captures reflect point-in-time state; re-list for newer captures.
- Use callable read-only tools rather than asking the merchant for screenshots when the tool can answer.
- Local lock absence (`globalInactivityProven=false`) reflects single-process RAM only—never global inactivity across workers/instances. Eligibility (`eligible=true`) is run-gate state, never permission to execute research. Neither `Ready to Run` nor null/empty saved fields proves retry safety. Never retry or bypass blocked website or Mohs reports via status reads or alternate paths.
- RAM cache is process-local (30-min base TTL, shop/global caps, temporary pins) and does not survive restarts, spin-downs, or separate workers. Empty cache, tool unavailability, or `not_found` does not prove blank fields, passing checks, or failed/nonexistent research. Report exact error codes and partial-coverage indicators.

## Bench: live_bench_state
- Match intended `productId` and `benchSessionId` (newest is not necessarily active). Read `index`, `header`, and `review` first, then `drawer` or `field` for specific fields; `Description Review` uses `view=drawer` and `drawer="Description Review"`.
- `native_description` and `custom.generated_description` stay separate across baselines, proposals, approvals, conflicts, and saves. Inspect `header`, `review`, and applicable drawers (including unchanged fields); an empty `review` drawer alone does not prove field accuracy.
- `rawStoredBaseline` is the last loaded manifest snapshot (not a live Shopify read); `evaluatedBaseline` may include template placeholders; `workingState` holds unsaved proposals/edits/UI approvals. Proposed, approved, and saved states are distinct; cache sync alone neither writes to Shopify nor proves storefront DOM rendering.

## Theme: theme_editor_readback
- Point-in-time active MAIN-theme snapshot (not continuous state, Bench state, or unsaved native Theme Customizer edits). Match `capturedAt`, `reportId`, `theme`, `productId`, `runIdentity`, and `selectedEditorFile`.
- Read `ui_audit` chunks first (`provenanceBoundaries`, `completenessAndCaps`, `savedTemplateOrderIndex`, `thisAppDraftTemplateOrderIndex`, `sharedShellGroupOrderIndex`, `reportSectionPointers`), then `report` chunks (template/shared structures, `referencedSectionSchemasAndOptions`, `globalThemeSettings`, `productIdentityAndValues`, `selectedEditorFileReadback`).
- Distinguish saved MAIN theme assets (REST Asset API), app unsaved selected-file buffer, and native Theme Customizer unsaved state (`UNKNOWN_NOT_CAPTURED_BY_THIS_ROUTE` unless captured). Source/schema order does not prove responsive layout, visibility, or accessibility.
- Check `sharedShellGroupOrderIndex` / `sharedSectionGroups` (`availability`, `status`, `error`, `parseOk`) and `completenessAndCaps` (`hasNextPage`, `isComplete`, `omittedSectionAssetKeys`); missing/failed reads differ from verified empty groups. Static path matching is not live Liquid rendering; filtered, capped, or unmatched expressions remain unverified.

## Research: gemini_grounded_research
- List with `mode="gemini_grounded_research"` and omit `productId` for product-free reports; read one `reportId` at a time from `chunkIndex=0` through completion (never via Bench views like `header`) before parsing `modelSynthesisAnswer`, `sourcesByOriginalChunkIndex`, and `modelAnswerSpanAttributions`.
- Preserve original `chunkIndex`, `uri`, and `title`. Entries in `modelAnswerSpanAttributions` (`groundingSupports`) with `isVerbatimSourceQuotation=false` map model synthesis spans to cited web sources and are not verbatim quotations. Citation links identify retrieved sources without proving factual accuracy, publication dates, or authorship; `searchEntryPoint` holds provider search suggestion metadata.
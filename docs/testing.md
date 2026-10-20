# Testing

## Automated checks

Run the following before handing off a release build:

```sh
npm run compile
npm test
npm run build
npm run verify:popup
```

Use focused Vitest commands while iterating, then run the complete suite before completion.

After sidebar placement or scrolling changes, build the extension and run `npm run verify:sidebar` with Playwright Chromium installed (`npx playwright install chromium`). This loads the actual built extension in a temporary browser profile against locally routed X fixtures with constrained and pinned native-search shells. It reproduces clipping at the previous insertion point, then checks that the workspace clears the pinned search header, the first label is unobscured using hit testing, the workspace fits the viewport, the last action is reachable and launches, and native X search remains usable. On profile and conversation fixture routes, it scrolls the page down and back up to check that the workspace stays at its 72-pixel sticky offset and its first label remains unobscured in light/dark themes at 900-, 600-, and 360-pixel window heights. Search-tab destinations are recorded and replaced with blank tabs to avoid live X requests. It inspects the production closed Shadow DOM through Chromium's debugging protocol; no X login is needed. Browser fixture checks complement the live X matrix below.

Sidebar URL-prefill coverage must prove normalized profile/conversation targets override restored targets only after loading, navigation updates the mounted form, same-view edits remain possible, unsupported routes retain the target, filters remain intact, and prefilling neither launches nor promotes history.

Date-shortcut coverage must verify local calendar arithmetic across month/year boundaries, leap-day clamping for twelve months, one patch for both dates, unchanged handles/keyword, manual overrides, and launch waiting for the date write.

Quick X search regression coverage must prove that the shared popup/sidebar builder restores and synchronizes persisted handles, keyword, dates, saved-account suggestions, free-form targets, and autosuggest history; supports the targetless `from:{me}` and `to:{me}` variants; validates required handles; launches only validated searches in a new tab; records target history only after a successful launch; and remains usable when optional suggestions/history sources fail. X-sidebar mount coverage must capture the closed Shadow DOM root and prove that both workspace sections, their shared styles, and launch controls render inside it but are not page-queryable. Observer coverage must prove that the complete, always-expanded workspace mounts directly inside the validated sidebar column before the native search branch, survives internal form-wrapper changes, remounts exactly once after form replacement or column-placement changes, and fails closed without form-and-column evidence while leaving X's native search and separately governed widget policy usable.

## X DOM fixtures

Store observed X markup variants under `tests/fixtures/x/`. Fixtures are minimal structural examples named for the DOM variant rather than a real account. Do not treat a live X selector or DOM hierarchy as a stable API.

Every fixture must have an assertion that identifies the protected behavior. Include negative assertions where they matter, such as proving that action labels do not become display names or that unrelated page handles are ignored.

The minimal native-search fixture includes a validated sidebar column, native search form, and representative news, sports, trends, and follow modules. The constrained-search-shell fixture adds representative fixed-height, centering, clipping, transform, and negative sticky-offset geometry; it is a regression model, not a captured live X DOM. Assert Contexto placement outside those wrappers as a direct column child before the native branch, preservation of native styles and input, and cleanup when form replacement or branch changes invalidate placement. Internal form reparenting within the same native branch must preserve the workspace.

Sidebar-policy tests must cover default hiding, enabled `50vh` spacing on only the first native module, live setting changes, module replacement, exact restoration of prior inline styles and Contexto markers, and fail-closed behavior when the native form is outside a validated sidebar column.

Post-bookmark fixtures must prove that the validated primary-author status URL and top-level post text are selected while quoted-post links/text, mismatched handles, ambiguous status links, and promoted posts fail closed.

## Interaction lifecycle tests

Use controller tests with composed Shadow DOM events for mounting, focus, and dismissal behavior. Explicitly assert interactions that must not close the editor, including internal clicks, backdrop clicks, and Escape.

Feed relationship-panel coverage must prove that the marker stays in the validated author header while its panel renders in a separate document-body Shadow DOM host, outside post transforms and clipping. Verify matching light/dark styles, viewport bounds and scrolling, composed internal pointer events, composer focus, compact-panel dismissal and draft clearing, handoff to the full editor, and cleanup of both hosts.

Use surface tests for successful Save, failed Save, Cancel, draft retention, and the inline-versus-modal lifecycle distinction. A failed Save must leave the owned editor and draft available; the full-profile inline editor must remain visible after Save or Cancel.

Role-, company-, and location-suggestion coverage must include active-account extraction, trimming, blank removal, case-insensitive deduplication, stable ordering, exact/prefix/substring/fuzzy ranking, keyboard and pointer selection, free-text retention, disabled behavior, and successful selection for all three fields in both the X editor and dashboard.

Autocomplete layout coverage must assert that the dashboard and X editors load the same suggestion styles, including neutral defaults and teal hover/highlight states. Dashboard layout coverage must keep the Location suggestion panel inside its control and verify it overlays beneath the input without adding grid height or shifting Company.

Bookmark component tests cover duplicate lookup, optional-reminder capture, pending controls, success, retry-preserved drafts, Cancel/panel-close clearing, dashboard reminder editing and Handled/Reopen controls, loading/update/removal errors, safe source links, empty collections, and stale account requests. Repository tests cover ownership and URL validation, field bounds, transactional reminder/completion updates, deduplication, soft deletion/restoration, recency ordering, change logging, handled-state backup validation, backup format 1/2 compatibility, and permanent account deletion of all account-owned rows while retaining shared lookups. Dashboard tests cover the required confirmation and cancellation path for account deletion.

Prior-interaction shortcut tests cover normalized two-way query construction, live X search URL parameters, invalid handles, safe new-tab attributes, conditional visibility, and settings-failure isolation from saved context and bookmark capture.

Catch-up tests cover first-use and checkpointed author queries, invalid handles/timestamps, safe new-tab attributes, explicit checkpoint writes, backup preservation, background routing, dashboard/feed controls, and failed-write isolation.

Feed quick-note tests cover no-write opening, autofocus, non-empty saves, pending controls, authoritative latest-note refresh, failed-save draft retention, Cancel/panel-close clearing, bookmark-composer exclusion, and background note routing.

Feed grouping-editor tests cover existing assignments, empty fields, suggestion selection, free-text creation when suggestions fail, removal, pending-input saves, authoritative summary refresh, failed-save draft retention, disabled pending controls, Cancel/panel-close clearing, and stale response isolation. Repository and background coverage verify assignment-only saves, deduplication, preserved contact metadata and shared definitions, and invalid or missing-account rejection.

## Manual browser checks

Synthetic tests cannot reproduce every X or browser lifecycle. Run the matrix in [Browser Development Workflow](development/browser-workflow.md) while signed in to X in both Chrome and Vivaldi after changing content-script mounting, X selectors, popup layout, Shadow DOM behavior, or extension lifecycle handling. For Quick X search, this includes light and dark themes; saved-account suggestions and free-form targets; target-present and targetless searches; successful and failed launches; popup/sidebar state restoration; X rerenders; and extension reload.

Account identity coverage verifies optional X IDs, precision-preserving persistence, preservation on ID-less saves, conflict/invalid-ID rejection, backup round trips, and preservation of contact creation dates. Dashboard coverage verifies read-only ID and contact timestamps. Existing tags support multiple List-derived labels without List entities.

Shared grouping management coverage verifies tag/circle usage counts and inactive-contact exclusion; search, sorting, unused filters, affected-contact previews, rename collision-to-merge, merge union/deduplication, explicit deletion confirmation and Cancel, unused-definition deletion, and retry/pending controls. Repository tests verify all-join hard deletion, unchanged unrelated data, transactional rollback on late failures, stale management/full-context/grouping-only rejection before writes, and revision backup preservation. Editor integration tests use the actual repositories to verify draft retention across remount, failed-save lifecycle, explicit Reload saved values, and successful retry.

Company management coverage verifies unused records, active/inactive usage, rename identity/details preservation, merge reassignment and destination website/notes rules, deletion with reference clearing, validation, rollback, and backup compatibility. Role/location cleanup coverage verifies case/trim grouping, active/inactive matches, existing/new replacement, clear confirmation and Cancel, blank rejection, unrelated-field preservation, suggestion refresh, pending/error/retry behavior, and transactional rollback. Real-repository editor tests reject stale X and dashboard company/role/location drafts, retain input, and reload authoritative values before retry; explicit X reload must not reintroduce cleared metadata from an older profile snapshot.

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

Quick X search regression coverage must prove that the shared popup/sidebar builder restores and synchronizes persisted handles, keyword, dates, saved-account suggestions, free-form targets, and autosuggest history; supports the targetless `from:{me}` and `to:{me}` variants; validates required handles; launches only validated searches in a new tab; records target history only after a successful launch; and remains usable when optional suggestions/history sources fail. X-sidebar mount coverage must capture the closed Shadow DOM root and prove that both workspace sections, their shared styles, and launch controls render inside it but are not page-queryable. Observer coverage must prove that the complete, always-expanded workspace mounts immediately before the validated native form, remounts exactly once after X replaces or reparents the same form or a sibling is inserted or reordered, and fails closed without native-form evidence while leaving X's native search and separately governed widget policy usable.

## X DOM fixtures

Store observed X markup variants under `tests/fixtures/x/`. Fixtures are minimal structural examples named for the DOM variant rather than a real account. Do not treat a live X selector or DOM hierarchy as a stable API.

Every fixture must have an assertion that identifies the protected behavior. Include negative assertions where they matter, such as proving that action labels do not become display names or that unrelated page handles are ignored.

The minimal native-search fixture includes a validated sidebar column, native search form, and representative news, sports, trends, and follow modules. It must assert Contexto placement as the form's immediate previous sibling, preservation of the native input, and cleanup when the native form is replaced, reparented, or separated from the host by sibling insertion or reordering.

Sidebar-policy tests must cover default hiding, enabled `50vh` spacing on only the first native module, live setting changes, module replacement, exact restoration of prior inline styles and Contexto markers, and fail-closed behavior when the native form is outside a validated sidebar column.

Post-bookmark fixtures must prove that the validated primary-author status URL and top-level post text are selected while quoted-post links/text, mismatched handles, ambiguous status links, and promoted posts fail closed.

## Interaction lifecycle tests

Use controller tests with composed Shadow DOM events for mounting, focus, and dismissal behavior. Explicitly assert interactions that must not close the editor, including internal clicks, backdrop clicks, and Escape.

Feed relationship-panel coverage must prove that the marker stays in the validated author header while its panel renders in a separate document-body Shadow DOM host, outside post transforms and clipping. Verify matching light/dark styles, viewport bounds and scrolling, composed internal pointer events, composer focus, compact-panel dismissal and draft clearing, handoff to the full editor, and cleanup of both hosts.

Use surface tests for successful Save, failed Save, Cancel, draft retention, and the inline-versus-modal lifecycle distinction. A failed Save must leave the owned editor and draft available; the full-profile inline editor must remain visible after Save or Cancel.

Company- and location-suggestion coverage must include active-account extraction, trimming, blank removal, case-insensitive deduplication, stable ordering, exact/prefix/substring/fuzzy ranking, keyboard and pointer selection, free-text retention, disabled behavior, and successful selection for both fields in both the X editor and dashboard.

Autocomplete layout coverage must assert that the dashboard and X editors load the same suggestion styles, including neutral defaults and teal hover/highlight states. Dashboard layout coverage must keep the Location suggestion panel inside its control and verify it overlays beneath the input without adding grid height or shifting Company.

Bookmark component tests cover duplicate lookup, optional-reminder capture, pending controls, success, retry-preserved drafts, Cancel/panel-close clearing, dashboard reminder editing and Handled/Reopen controls, loading/update/removal errors, safe source links, empty collections, and stale account requests. Repository tests cover ownership and URL validation, field bounds, transactional reminder/completion updates, deduplication, soft deletion/restoration, recency ordering, change logging, handled-state backup validation, backup format 1/2 compatibility, and permanent account deletion of all account-owned rows while retaining shared lookups. Dashboard tests cover the required confirmation and cancellation path for account deletion.

Prior-interaction shortcut tests cover normalized two-way query construction, live X search URL parameters, invalid handles, safe new-tab attributes, conditional visibility, and settings-failure isolation from saved context and bookmark capture.

Catch-up tests cover first-use and checkpointed author queries, invalid handles/timestamps, safe new-tab attributes, explicit checkpoint writes, backup preservation, background routing, dashboard/feed controls, and failed-write isolation.

Feed quick-note tests cover no-write opening, autofocus, non-empty saves, pending controls, authoritative latest-note refresh, failed-save draft retention, Cancel/panel-close clearing, bookmark-composer exclusion, and background note routing.

## Manual browser checks

Synthetic tests cannot reproduce every X or browser lifecycle. Run the matrix in [Browser Development Workflow](development/browser-workflow.md) while signed in to X in both Chrome and Vivaldi after changing content-script mounting, X selectors, popup layout, Shadow DOM behavior, or extension lifecycle handling. For Quick X search, this includes light and dark themes; saved-account suggestions and free-form targets; target-present and targetless searches; successful and failed launches; popup/sidebar state restoration; X rerenders; and extension reload.

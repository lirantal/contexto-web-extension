# Embedded X Quick Search Design

## Goal

Show Contexto's complete **Quick X search** builder as an always-expanded surface in X's right sidebar while retaining the existing browser-toolbar popup and saved-account search.

## Scope

- Keep the popup's current fields, four search actions, query previews, autosuggest behavior, and persisted values.
- Render the same search workflow beneath the saved-account search in Contexto's existing X sidebar host.
- Keep the embedded form always expanded whenever the validated X sidebar mount is available.
- Preserve the existing native X search field and sidebar-widget visibility policy.
- Support light and dark X themes, X client-side rerenders, extension invalidation, and narrow layouts where the X right sidebar is absent.

Out of scope: removing or replacing the toolbar popup, modifying X's native search behavior, adding search directions, redesigning search-history storage, opening a detached browser window, or adding a collapse preference.

## User Experience

The existing Contexto card above X's native search becomes a single right-sidebar workspace with two distinct sections:

1. **Search Contexto accounts** retains the current local saved-account lookup and current-tab profile navigation.
2. **Quick X search** is always visible beneath it and contains My X handle, Other person's X handle, Keyword, Since, Until, and the four search action buttons.

The embedded form uses the same persisted values as the popup. Editing either surface updates extension-local state, so the next mount of the other surface restores the same values. Target-handle suggestions continue to combine saved X accounts and recent searched handles. Launching a search retains the popup's current behavior: it opens the generated X search in a new tab, then records the normalized target handle on a best-effort basis.

The embedded surface adapts to the right rail rather than copying the popup's fixed 400-pixel shell. Inputs and actions use the available width, date fields may stack when space is tight, and query previews truncate visually while remaining available through button titles. The popup keeps its existing compact dimensions and footer controls.

## Architecture

Extract the popup's reusable search workflow into a shared React component with explicit dependencies for loading suggestions, opening a search, and opening the dashboard. A small shared state/controller hook owns settings, persisted search fields, recent target history, suggestion construction, validation, query generation, and successful-launch history recording.

The popup becomes a thin shell that supplies extension-page adapters: direct suggestion repository access, `browser.tabs.create`, and `browser.runtime.openOptionsPage`. Its existing header, footer, error boundary, fixed sizing, and verification contract remain intact.

The X sidebar wrapper supplies content-safe adapters. It loads saved accounts through the existing typed background sender, maps X account summaries to target suggestions, and requests the background service worker to open a new tab so the content script does not rely on privileged tab APIs. Settings, popup search state, and target-handle history remain WXT extension-local storage items and are watched so an already-mounted sidebar reflects changes made by another extension surface.

The existing `mountContextoSidebarSearch` Shadow DOM host remains the only X mount. It renders a composed sidebar workspace rather than creating a second host. The existing observer continues to discover `input[data-testid="SearchBox_Search_Input"]` inside a native form, remount after X replacements, prevent duplicates, and clean up on invalidation. No X-owned node is moved or read for identity data.

## Messages and Data Flow

Add a typed background request for opening a validated Contexto-generated X search URL in a new tab. The background handler uses `browser.tabs.create`; success is returned only after tab creation resolves. The shared search workflow records recent target history only after that success.

Saved-account suggestions in the content script use the existing `contexto:account:list` response. The sidebar wrapper maps active X summaries to the suggestion fields required by the shared matcher: id, handle, display name, company name, and updated timestamp. A failed account request or failed history read leaves free-form target entry and search actions usable.

Search state flows as follows:

1. A surface loads settings, popup search state, saved-account suggestions, and recent target history independently.
2. Field changes update local React state immediately and persist the appropriate storage item.
3. A search action builds and validates filters with the existing X adapter.
4. The supplied launcher opens a new X tab.
5. After successful launch, the normalized target is promoted in recent history; launch success is never undone by history-write failure.

## Failure and Lifecycle Behavior

- Independent loading failures must not blank either search surface.
- A failed tab launch leaves target history unchanged and keeps the form available for retry.
- A failed post-launch history write does not report the already-opened search as failed.
- X sidebar remounts reuse persisted field values and never create duplicate Contexto hosts.
- Missing native-search evidence prevents the entire Contexto sidebar workspace from mounting and leaves X untouched.
- Extension invalidation unmounts the React root, removes the host, stops storage watchers, and restores the existing native-widget policy state.
- Search field interaction must not submit X's native search form or propagate an unintended form submission.

## Testing

- Shared quick-search component tests cover restored state, field persistence, enabled and disabled actions, query previews, successful launch, failed launch, post-launch target-history recording, and partial data-source failures.
- Popup tests continue to prove popup-specific tab and dashboard adapters, fixed-shell rendering, autosuggest, and error recovery.
- Sidebar component tests prove the saved-account search and always-expanded Quick X search render together, account summaries become rich target suggestions, searches use the background launch request, and free-form search survives suggestion-loading failure.
- Background tests cover the new-tab request success and failure responses.
- Mount/observer tests continue to cover placement before native search, one-host remount behavior, and cleanup after X replaces the native form.
- CSS contract tests cover responsive sidebar width, separate section styling, dark/light palettes, and the always-expanded form without popup-only fixed dimensions.
- Final verification runs `npm run compile`, `npm test`, `npm run build`, and `npm run verify:popup`, followed by the documented Chrome/Vivaldi manual QA rows for the X sidebar and toolbar popup.

## Documentation

Update the architecture overview, X search-builder feature documentation, platform-adapter sidebar invariant, browser QA matrix, and testing guidance. The canonical docs must state that the toolbar popup and X sidebar share one persisted Quick X search workflow and that the X version is always expanded inside the validated Contexto-owned sidebar host.

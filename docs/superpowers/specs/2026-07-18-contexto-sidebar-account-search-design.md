# Contexto Sidebar Account Search Design

## Goal

Let a user find a saved Contexto account from X's right sidebar, using a dedicated Contexto search field positioned directly above X's native search field. Choosing a result opens that account's X profile in the current tab.

## Scope

- Search saved X accounts by display name and handle only.
- Use case-insensitive fuzzy matching with deterministic ranking.
- Keep Contexto's search UI visually and structurally separate from X's native search UI.
- Support X's client-side rerenders without duplicate or orphaned mounts.

Out of scope: searching unsaved X accounts, editing account metadata from the results, search history, keyboard navigation, and changing X's own search input or results.

## User Experience

The component appears in X's right column only when X's native search field is present. It renders immediately above that field and uses Contexto copy, such as `Search Contexto accounts`, to distinguish local CRM search from X-wide search.

The user types a display name or handle fragment. Once the query is non-empty, the component shows at most five saved accounts, each with its display name when known and its `@handle`. No matching accounts produces a compact `No saved accounts found` message. Clearing the query removes the results list. A failure to load saved accounts is contained to the Contexto component and leaves X's native search unaffected.

Selecting a result uses `window.location.assign(account.profileUrl)` (or the canonical `https://x.com/<normalized-handle>` fallback) so X opens the selected profile in the current tab. The component does not open a new tab.

## Data and Matching

The content script requests saved account summaries through the existing `contexto:account:list` background message. It filters to X accounts and retains only the fields required for the UI: `displayName`, `handle`, `normalizedHandle`, and `profileUrl`. Account data remains in Contexto's extension storage; no search data is sent to X.

Matching normalizes query and candidates by lowercasing, removing a leading `@`, and comparing letters, numbers, and underscores. A result is eligible when the normalized query is a substring of its display name or handle, or when its characters occur in order in either value. Ranking is deterministic:

1. Exact handle or display-name match.
2. Handle or display-name prefix match.
3. Contiguous substring match.
4. Ordered-character fuzzy match, ranked by tighter character spans.
5. Display name, then normalized handle, as stable tie breakers.

The matcher must not search company, role, notes, folders, tags, or other account fields.

## Architecture

Add a focused sidebar-search mount path alongside the existing hover, full-profile, and feed surface mounting. A sidebar observer finds X's native search input using its documented current DOM evidence (`[data-testid="SearchBox_Search_Input"]`), resolves the smallest containing search wrapper, and inserts a Contexto-owned host directly before that wrapper. It observes X rerenders, reuses a connected host, and unmounts when the native wrapper disappears or is replaced.

The host owns an open Shadow DOM root and the existing Contexto surface CSS is extended with sidebar-search styles. The component receives the existing typed runtime sender; it has no direct IndexedDB access and never moves, styles, or mutates X-owned nodes. Theme detection uses the native search wrapper as the host context.

## Error Handling and Lifecycle

The component starts in a loading state while the saved-account request is pending. If the request fails or returns an unsuccessful response, it renders a concise unavailable message and remains isolated; retrying happens when X remounts the sidebar or the component mounts again. It must not throw into the content-script observer or block X input events.

The sidebar observer and mounted React root are disconnected during content-script invalidation. Location changes do not themselves require data writes or page-editor changes. Multiple observer callbacks must not create duplicate Contexto sidebar-search hosts.

## Testing and Documentation

- Add a minimal X fixture that represents the native right-column search wrapper and assert that Contexto mounts immediately before it without modifying the native input.
- Add matcher tests covering display-name and handle matches, case-insensitivity, leading `@`, ranking, fuzzy ordered-character matching, and excluded metadata fields.
- Add component tests for loading, result limiting, no results, load failure, and current-tab navigation on selection.
- Add mount/observer tests covering safe remount and cleanup when X replaces the native search wrapper.
- Update the account-search feature documentation, platform-adapter DOM-invariant guidance, browser QA matrix, and testing guidance to describe the in-page local account search and its fixture coverage.

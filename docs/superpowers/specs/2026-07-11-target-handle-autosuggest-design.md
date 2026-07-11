# Target Handle Autosuggest Design

## Goal

Enhance the toolbar popup's **Other person's X handle** field with a rich, accessible autosuggest that uses saved Contexto account metadata and recent target-handle search history without restricting free-form typing or pasting.

## Suggestion sources and matching

Suggestions combine two local sources:

- Active saved X accounts from the Contexto Dexie database, including handle, display name, company, and `updatedAt`.
- A separate extension-local target-handle history containing the 20 most recently searched unique normalized handles and their search timestamps.

Saved accounts match typed text case-insensitively against handle, display name, and company only. Unsaved history entries match by handle. Selecting any suggestion inserts only its normalized `@handle`; text that does not match a suggestion remains valid and searchable.

When the field is focused with no query, recent-history handles appear first, followed by recently updated saved accounts. Duplicate handles across both sources collapse into one enriched saved-account row. With a query, matches rank by handle, then display name, then company, with recency breaking ties.

## Interaction and presentation

The field becomes an ARIA combobox backed by a floating listbox. The popup loads its suggestion sources when it opens and shows suggestions when the field gains focus. Users can:

- Type or paste arbitrary text without forced completion.
- Move through results with Arrow Up and Arrow Down.
- Choose the highlighted result with Enter.
- Choose a result with the mouse.
- Close the list with Escape or by moving focus outside the combobox.

Each saved-account row shows the display name, `@handle`, and company when available. History-only rows show the handle, and recently searched entries have a subtle **Recent** indicator. The list overlays the popup content, has a bounded scrolling region, and does not increase the popup's normal document height.

## Architecture

A focused `TargetHandleCombobox` React component owns listbox visibility, highlighted-row state, keyboard navigation, outside-focus behavior, and ARIA wiring. It receives controlled input text, a prepared suggestion list, and an `onChange` callback, leaving the popup's existing `searchState.targetHandle` as the source of truth.

A lightweight repository query returns only active X account suggestion data instead of hydrating full account summaries with tags, folders, and notes. A pure suggestion builder merges account data and history, deduplicates normalized handles, applies the matching/ranking rules, and returns presentation-ready rows. Keeping this logic outside the component makes ranking deterministic and directly testable.

Target-handle history uses a typed WXT extension-local storage item rather than the general Dexie `searchHistory` table. This prevents the dashboard clear action from deleting full search records and avoids a database/backup migration for a capped 20-entry recency list. Pure helpers normalize, deduplicate, move repeated handles to the front, and enforce the limit.

## History lifecycle and clearing

A nonempty target handle enters history only after `browser.tabs.create()` successfully launches an X search. Disabled searches and failed tab creation do not change history. Repeating a handle updates its timestamp and moves it to the top; comparisons are case-insensitive after X-handle normalization. Free-form handles that do not correspond to saved accounts are retained.

The dashboard Settings panel adds a **Clear target handle history** button. Activating it clears only the autosuggest recency list, does not delete saved accounts or full search-history records, and displays a brief status confirmation.

## Error handling

If account suggestions or history cannot be loaded, the controlled input remains fully usable as a free-text field and the popup shows whichever source did load. History is recorded after successful tab creation; a history-storage failure must not undo or block the already launched search. The clear action reports failure through the dashboard's existing status area instead of affecting account data.

## Accessibility

The input exposes `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` while a row is highlighted. Suggestions use listbox/option roles, highlighted state is visually apparent, and mouse selection does not steal focus before the controlled value is updated. Free-form entry and the existing label remain intact.

## Testing and verification

Automated tests cover:

- History normalization, case-insensitive deduplication, repeat promotion, 20-entry capping, and clearing.
- Saved-account suggestion reads excluding deleted and non-X accounts.
- Empty-state merging and recency ordering.
- Matching and ranking across handle, display name, and company only.
- Free-text preservation plus mouse and keyboard selection behavior.
- History recording only after successful searches and omission after failed/disabled searches.
- Dashboard history clearing and status feedback.

Final verification runs the complete Vitest suite, TypeScript compilation, Chrome extension build, and `git diff --check`.

## Out of scope

- Matching notes, tags, folders, profession, position, or location.
- Network-backed X account lookup or suggestions.
- Forcing the input to contain a saved account.
- Deleting individual history entries.
- Changing the existing general search-history or backup formats.

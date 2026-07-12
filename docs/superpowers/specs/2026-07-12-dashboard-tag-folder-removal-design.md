# Dashboard Tag And Folder Removal Design

## Goal

Let users remove tag and folder assignments from an account in the Contexto dashboard. The dashboard chips should expose the same visible `×` affordance as the profile editor, and removal should persist immediately, matching the dashboard's existing immediate Add actions.

## Scope

- Add removal controls to every assigned tag and folder chip in the dashboard account detail view.
- Remove only the selected assignment from the current account.
- Keep the underlying tag or folder available for other accounts and future assignment.
- Preserve the dashboard's existing tag and folder Add controls.

Global tag/folder deletion, renaming, confirmation dialogs, and a broader dashboard metadata-editor redesign are outside this change.

## Data Layer

Add focused repository operations for removing one tag assignment and one folder assignment from an account. Each operation accepts the account ID and the assigned entity ID, deletes the matching join record if present, records the account change consistently with assignment operations, and returns the authoritative updated `AccountSummary`.

Removal is idempotent: requesting removal of a missing assignment leaves the account unchanged and still returns its current summary. Neither operation soft-deletes or otherwise mutates the tag or folder entity.

## Dashboard UI

Each tag and folder chip contains its name followed by a small, transparent `×` button. The control uses the existing chip colors and follows the profile editor's compact removable-chip styling.

The buttons have explicit accessible names:

- `Remove <name> from Tags`
- `Remove <name> from Folders`

Clicking a removal button calls the corresponding repository operation immediately. Dexie's live query refreshes the selected account summary, causing the removed chip to disappear without a separate save action.

## Error And Interaction Behavior

The change retains the dashboard's current mutation model: repository failures reject without optimistic local removal. No confirmation is required because removing an assignment is a narrow, reversible action—the tag or folder itself remains intact and can be added again.

The removal button is `type="button"` so it cannot accidentally submit any surrounding form if the layout changes later.

## Testing

Repository tests will prove that tag and folder removal:

- deletes only the requested account assignment;
- leaves the underlying lookup entity intact;
- returns an updated account summary without the removed item.

A dashboard component test will render an account with an assigned tag and folder, click each accessible removal button, and verify that the matching repository operation receives the selected account ID and entity ID.

The focused tests will be run first, followed by the full test suite, TypeScript compilation, and production build.

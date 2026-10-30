# Storage And Sync

## Local Storage

Contexto stores CRM data in IndexedDB through Dexie. This provides browser-native structured persistence, indexes, transactions, and offline dashboard access without shipping SQLite WASM.

Extension settings use WXT storage over `chrome.storage.local` through `src/shared/settings.ts`. Settings currently include:

- `myXHandle`
- `lastDashboardView`
- `showNativeXSidebarWidgets` (defaults to `false`; legacy values are normalized on read)

Quick X search state and target-handle autosuggest history also use WXT local storage. Popup, sidebar, and dashboard settings edits cross the typed background-message boundary as narrow patches. The background serializes settings patches, Quick X search-state patches, and target-history promotions in separate recoverable queues, so concurrent surfaces preserve unrelated fields and a rejected write does not poison later work. Search launches wait for outstanding field patches; target promotion is attempted only after a successful tab launch.

## Persistence Expectations

IndexedDB data persists while the extension remains installed in the same browser profile. It is not a replacement for backups. If the extension is removed, the browser can remove extension-origin storage as well.

The MVP includes JSON export/import from the dashboard. Backups should be taken before risky browser-profile changes, extension reinstallations, or large schema migrations.

Current exports use backup format 2 and include whole records from every database table in one consistent read transaction. Import supports formats 1/2 with complete record/reference validation, a conflict-refusing safe merge, and explicit atomic full restore. Dashboard imports require a reviewed preview and verified recovery-file export. See [Backup and restore](../features/backup-restore.md).

Disabling/re-enabling or reloading the same installation should retain committed data; unsaved drafts are memory-only. Keep the extension ID and persistent browser profile stable during development. Uninstall, profile removal, or device failure requires an external recovery file. There is no automatic external backup or remote sync. The `unlimitedStorage` permission protects against ordinary Chromium quota/eviction, not these lifecycle events.

## Future Remote Sync

The schema is prepared for a later sync service through:

- Stable IDs.
- `createdAt` and `updatedAt` fields.
- Soft delete fields.
- `syncState` on accounts.
- `changeLog` records for local mutations.

No remote service, authentication, or network sync is implemented in this MVP.

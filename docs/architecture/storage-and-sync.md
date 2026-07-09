# Storage And Sync

## Local Storage

Contexto stores CRM data in IndexedDB through Dexie. This provides browser-native structured persistence, indexes, transactions, and offline dashboard access without shipping SQLite WASM.

Extension settings use WXT storage over `chrome.storage.local` through `src/shared/settings.ts`. Settings currently include:

- `myXHandle`
- `lastDashboardView`

## Persistence Expectations

IndexedDB data persists while the extension remains installed in the same browser profile. It is not a replacement for backups. If the extension is removed, the browser can remove extension-origin storage as well.

The MVP includes JSON export/import from the dashboard. Backups should be taken before risky browser-profile changes, extension reinstallations, or large schema migrations.

## Future Remote Sync

The schema is prepared for a later sync service through:

- Stable IDs.
- `createdAt` and `updatedAt` fields.
- Soft delete fields.
- `syncState` on accounts.
- `changeLog` records for local mutations.

No remote service, authentication, or network sync is implemented in this MVP.

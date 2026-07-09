# Feature: Backup And Restore

The dashboard can export all Contexto local data as JSON and import it back later.

Export includes:

- Accounts.
- Companies.
- Tags and account-tag joins.
- Folders and folder-account joins.
- Notes.
- Search presets and history.
- Backup metadata.
- Change log.

Imported records are merged by ID through Dexie `bulkPut`. Treat exported JSON as sensitive relationship data.

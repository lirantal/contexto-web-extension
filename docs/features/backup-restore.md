# Feature: Backup And Restore

The dashboard can export all Contexto local data as JSON and import it back later.

Export includes:

- Accounts.
- Companies.
- Tags and account-tag joins.
- Folders and folder-account joins.
- Notes.
- Bookmarks, including reminder and handled state.
- Search presets and history.
- Backup metadata.
- Change log.

Imported records are merged by ID through Dexie `bulkPut`. Importing an older backup can restore tags/folders and assignments removed through Manage data; this is a merge, not a rollback or deletion-aware restore. Catalog revision entries are included in the change log. Treat exported JSON as sensitive relationship data.

Version 2 bookmark import validates ownership, canonical X identity, post ID, text bounds, and all present timestamps—including the optional handled timestamp—before writing.

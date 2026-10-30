# Feature: Backup And Restore

The dashboard Settings area exports and imports the complete contact database as JSON. Export reads all current database tables in one consistent IndexedDB read transaction and includes every stored field on each record, including optional fields and fields not displayed by the current UI.

The file includes accounts, companies, tags and account-tag joins, circles (`folders`) and circle-account joins, notes, bookmarks with reminders/handled state, search presets and history, import metadata (`backups`), and the change log. Avatar images and X posts remain URL references rather than downloaded media. Settings, Quick X search state, and target autosuggest history stored in `chrome.storage.local` are outside this database export.

Keep exported files outside the browser profile and treat them as sensitive relationship data. The export action requests a download; verify that the JSON file actually saved. The local `backups` table and change log contain event metadata, not recovery snapshots or field history.

## Import workflow

1. Select a JSON file. Contexto validates it and displays contact counts and new, identical, and conflicting record counts across all tables. Selection writes nothing.
2. Choose **Safe merge** or **Full restore**.
3. Select **Download recovery backup** and verify the downloaded JSON file before checking the confirmation box.
4. Select the explicit merge/replace action, or **Cancel import** to make no changes.

**Safe merge** adds records and accepts identical existing records. It refuses different records with matching IDs, natural-identity collisions, and invalid resulting relationships. It does not resolve conflicts using timestamps or overwrite an existing field. It can reintroduce records that were previously permanently deleted because there are no deletion tombstones for those records.

**Full restore** replaces all contact-database tables with the file's graph in one transaction, then appends an import metadata/event record. Current records absent from the file are removed. It does not restore settings. This is the explicit way to recover older values or restore into an installation containing conflicting data.

Both modes recheck the preview against the current database inside the write transaction. Another write after preview invalidates it: select the file again, review the new preview, and export a fresh recovery file. Any validation, uniqueness, or write failure aborts the transaction without partially importing or clearing data.

## Compatibility and validation

Export uses backup format 2. Import supports formats 1 and 2; a version 1 file without bookmarks supplies an empty bookmark collection (full restore therefore removes any existing bookmarks). Missing required tables, unsupported versions/tables, malformed known fields, invalid timestamps, duplicate IDs/identities, and dangling account/company/tag/circle references are rejected. Historical change-log entity references may refer to removed records by design.

X identities must agree across handle, normalized handle, and profile path. X user IDs remain precision-preserving decimal strings. Bookmark validation additionally checks canonical post URL, author, post ID, text bounds, and handled/capture timestamps. Legacy profession/position values are retained and supply a missing role during import. Other unknown record fields are retained rather than stripped.

See [Data integrity and development plan](../development/data-integrity.md) for migration policy, release checks, recovery limits, and the planned automatic external-backup work.

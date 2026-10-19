# Data Model

The current schema lives in `src/data/db.ts` and is versioned as Dexie version `3`.

## Core Records

- `accounts`: platform-neutral social accounts. Important fields include `platform`, `handle`, `normalizedHandle`, `displayName`, `profileUrl`, `role`, `companyId`, `location`, `relationshipSource`, the optional explicit `lastCatchUpAt` checkpoint, `syncState`, timestamps, and soft-delete metadata.
- `companies`: normalized company records referenced by accounts.
- `tags` and `accountTags`: many-to-many account labels.
- `folders` and `folderAccounts`: many-to-many relationship groups.
- `notes`: timestamped account notes.
- `bookmarks`: account-scoped X post references with canonical URL, post ID, optional excerpt/reminder, capture timestamp, optional handled timestamp, and soft-delete metadata.
- `searchPresets`: saved search filters for future expansion.
- `searchHistory`: generated X search URLs and filter payloads.
- `backups`: local record of import events and backup metadata.
- `changeLog`: append-only local mutation log for future sync.

## Account deletion

The dashboard's **Delete account** action is a permanent local delete. It removes the account, its notes, bookmarks (including previously soft-deleted bookmark rows), tag/folder joins, account-linked search history, and related change-log entries in one transaction. Shared companies, tags, and folders are retained because other accounts may use them; only this account's assignments are removed. There is no in-app undo, so export a backup first when recovery may be needed.

## Indexes

The important uniqueness constraints are:

- `accounts`: unique compound `[platform+normalizedHandle]`.
- `companies`: unique `normalizedName`.
- `tags`: unique `normalizedName`.
- `folders`: unique `normalizedName`.
- `accountTags`: unique compound `[accountId+tagId]`.
- `folderAccounts`: unique compound `[folderId+accountId]`.
- `bookmarks`: unique compound `[accountId+postUrl]`.

## Sync Readiness

Every user-edited core record uses stable UUID-based IDs and timestamps. Most synchronized deletes should remain soft deletes when remote sync is introduced so another client can converge without losing intent. The dashboard account deletion action is the explicit local-data erasure exception and intentionally removes the account-owned rows rather than leaving a tombstone.

Bookmarks remain separate from account notes and from `AccountSummary`. Focused lookup/list operations avoid loading every bookmark during ordinary account searches and feed relationship lookups.

Bookmark completion is represented by the optional `completedAt` timestamp on the existing record. Editing a reminder or toggling completion updates the bookmark, marks its account pending sync, and appends a bookmark change-log entry; no schema/index migration is required.

The catch-up checkpoint is an optional account field rather than a new table or index. It therefore remains compatible with the existing Dexie schema and backup format: account export/import naturally carries the ISO timestamp.

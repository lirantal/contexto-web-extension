# Data Model

The current schema lives in `src/data/db.ts` and is versioned as Dexie version `3`.

## Core Records

- `accounts`: platform-neutral social accounts. Important fields include `platform`, `handle`, `normalizedHandle`, `displayName`, `profileUrl`, `role`, `companyId`, `location`, `relationshipSource`, the optional explicit `lastCatchUpAt` checkpoint, `syncState`, timestamps, and soft-delete metadata.
- `companies`: normalized company records referenced by accounts.
- `tags` and `accountTags`: many-to-many account labels.
- `folders` and `folderAccounts`: many-to-many relationship groups.
- `notes`: timestamped account notes.
- `bookmarks`: account-scoped X post references with canonical URL, post ID, optional excerpt/reminder, capture timestamp, and soft-delete metadata.
- `searchPresets`: saved search filters for future expansion.
- `searchHistory`: generated X search URLs and filter payloads.
- `backups`: local record of import events and backup metadata.
- `changeLog`: append-only local mutation log for future sync.

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

Every user-edited core record uses stable UUID-based IDs and timestamps. Deletes should remain soft deletes when remote sync is introduced so another client can converge without losing intent.

Bookmarks remain separate from account notes and from `AccountSummary`. Focused lookup/list operations avoid loading every bookmark during ordinary account searches and feed relationship lookups.

The catch-up checkpoint is an optional account field rather than a new table or index. It therefore remains compatible with the existing Dexie schema and backup format: account export/import naturally carries the ISO timestamp.

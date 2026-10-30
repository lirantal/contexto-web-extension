# Data Model

The current schema lives in `src/data/db.ts` and is versioned as Dexie version `4`.

## Core Records

- `accounts`: platform-neutral social accounts. Important fields include `platform`, `handle`, `normalizedHandle`, `displayName`, `profileUrl`, optional `website`, `role`, `companyId`, `location`, `relationshipSource`, the optional explicit `lastCatchUpAt` checkpoint, `syncState`, timestamps, and soft-delete metadata.
- `companies`: normalized company records referenced by accounts.
- `tags` and `accountTags`: many-to-many account labels.
- `folders` and `folderAccounts`: many-to-many relationship groups displayed as Circles. Persisted table/field names and backup keys retain their original names for compatibility.
- `notes`: timestamped account notes.
- `bookmarks`: account-scoped X post references with canonical URL, post ID, optional excerpt/reminder, capture timestamp, optional handled timestamp, and soft-delete metadata.
- `searchPresets`: saved search filters for future expansion.
- `searchHistory`: generated X search URLs and filter payloads.
- `backups`: local record of import events and backup metadata.
- `changeLog`: append-only local mutation log for future sync.

## Shared value management

Dashboard management permanently deletes tag/circle definitions and their joins, or merges joins into another definition without duplicate assignments. Renaming preserves IDs. These operations update affected accounts and record entity/account mutations plus a `groupingCatalog` change-log entry in a single transaction. The sorted IDs of catalog entries form an opaque revision token. Account summaries and lookup responses read their data and revision in a consistent read transaction. The same marker covers company rename/merge/delete and bulk role/location replacement/clearing. Companies keep stable IDs on rename; merge reassigns source references, and deletion clears all references. Free-text cleanup writes matching active and inactive account rows directly. Full-context, dashboard metadata, and grouping-only saves compare the draft revision before writing; a stale or missing revision is rejected after the first catalog edit. No Dexie schema or backup format migration is required. See [Manage data](../features/data-management.md) and [Circles and tags](../features/folders-tags.md).

## Account deletion

The dashboard's **Delete account** action is a permanent local delete. It removes the account, its notes, bookmarks (including previously soft-deleted bookmark rows), tag/circle joins, account-linked search history, and related change-log entries in one transaction. Shared companies, tags, and circles are retained because other accounts may use them; only this account's assignments are removed. There is no in-app undo, so export a backup first when recovery may be needed.

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

Every user-edited core record uses stable UUID-based IDs and timestamps. Most synchronized deletes should remain soft deletes when remote sync is introduced so another client can converge without losing intent. Dashboard account deletion and Manage data shared-value deletion are explicit local-data erasure exceptions: they permanently remove account-owned rows or shared definitions and references rather than leaving tombstones.

Bookmarks remain separate from account notes and from `AccountSummary`. Focused lookup/list operations avoid loading every bookmark during ordinary account searches and feed relationship lookups.

Bookmark completion is represented by the optional `completedAt` timestamp on the existing record. Editing a reminder or toggling completion updates the bookmark, marks its account pending sync, and appends a bookmark change-log entry; no schema/index migration is required.

The catch-up checkpoint is an optional account field rather than a new table or index. It therefore remains compatible with the existing Dexie schema and backup format: account export/import naturally carries the ISO timestamp.

The profile website is an optional account field carried by existing account backup export/import; it requires no new index or schema version.

## X identity and contact dates

Accounts and profile snapshots accept optional `xUserId`: a positive decimal string of up to 19 digits, never a JavaScript number. Profile saves preserve an existing ID when the snapshot omits it and reject a conflicting supplied ID for the same saved handle. Backup import validates supplied IDs before writing; backup formats 1 and 2 remain supported. This optional field needs no index or Dexie schema migration. Account lookup remains handle-based; rename reconciliation and bulk API ingestion belong to the future importer.

`createdAt` and `updatedAt` already record the local contact's creation and most recent account update, including relationship activity that touches the account. They are not X's account creation date or profile observation timestamps. The dashboard shows them as **Added to Contexto** and **Last updated in Contexto**; embedded forms do not display them.

Future imports target people and relationships. List-derived labels use the existing many-to-many tags, including multiple labels for overlapping memberships. Contexto does not introduce List records or membership management.

## Preservation and concurrency

Database upgrades retain legacy `profession` and `position` fields; a missing role is derived from their distinct values (position first), without replacing a populated role. Version 4 also normalizes legacy values present in version 2/3 databases. Values removed by an already-executed older migration require recovery from a prior export.

Account summaries include an opaque `accountRevision` derived from the stored record and sorted tag/circle assignments. Draft editors retain it and compare it in the same transaction as their save. This supplements catalog revisions for ordinary edits and detects same-timestamp changes. It is response metadata, not a persisted contact field. See [Data integrity](../development/data-integrity.md).

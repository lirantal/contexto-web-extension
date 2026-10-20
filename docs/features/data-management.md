# Feature: Manage Data

Open **Manage data** in the dashboard to clean up shared values in the current browser profile. Tabs cover Tags, Circles, Companies, Roles, and Locations. Search by value, sort by name or active-contact usage, and select **View contacts** or any action to preview the affected active contacts. Company, role, and location previews also show how many inactive imported contacts will be updated.

## Companies

Companies are shared database records referenced by a contact's `companyId`. The Companies tab includes unused records and an **Unused only** filter.

- **Rename** preserves the company ID, website, notes, and contact associations. Names are trimmed, internal whitespace is collapsed, and normalized-name collisions offer a merge into the existing company.
- **Merge** reassigns all source contacts, including inactive ones, to the destination and permanently deletes the source record. The destination keeps its identity and nonblank website; a missing website is filled from the source. Distinct nonblank notes are combined with a blank line between them; identical notes are retained once. Conflicting websites are not combined, and the confirmation explains destination precedence.
- **Delete company everywhere** permanently deletes the record and clears `companyId` on every associated contact, including inactive ones. The confirmation states that company fields become empty. Contacts, notes, bookmarks, and all other metadata remain intact. Cancel performs no writes.

Live dashboard company filters discard IDs removed by merge/deletion while keeping other selections and the search query.

## Roles and locations

Role and Location remain free-text account fields; cleanup does not introduce lookup tables or restrict future input. Their tabs group stored nonblank values using the same trimmed, case-insensitive identity as autocomplete suggestions. Imported whitespace and case variants are included in one action. Internal spacing differences remain separate values. Values used only by inactive contacts remain manageable, with zero active contacts and an explicit inactive count. There is no unused-definition filter because these values have no independent records.

- **Replace everywhere** accepts an existing suggestion or new text, trims the replacement, previews the contacts, and updates every matching record. Replacing with an existing value naturally consolidates its usage. A blank replacement is rejected; use Clear everywhere instead. Case-only replacements can standardize capitalization.
- **Clear everywhere** requires explicit confirmation, then clears that field on all matching active and inactive contacts. Other values and fields are preserved.

Suggestions derive from active contacts, so cleaned values disappear from suggestions when no active contact uses them.

## Consistency, open drafts, and recovery

Each operation is one IndexedDB transaction including affected-account timestamps, pending-sync flags, entity logs where applicable, and a catalog revision entry. Failure rolls everything back and keeps the confirmation/input available for retry. A catalog change invalidates older management forms; cancel and reopen the action.

The existing `groupingCatalog` log and `groupingRevision` request/response field now cover every Manage data operation. These names are retained for stored-data and message compatibility. Profile-context, grouping-only, and dashboard metadata saves check the loaded revision inside their write transaction. A stale save performs no writes and preserves the draft. **Reload saved values** explicitly discards the metadata draft and loads current saved values before retrying. In X editors, this reload uses saved metadata without refilling cleared fields from the older X snapshot; ordinary editor opening retains the documented profile-prefill behavior. Save/Cancel close behavior is unchanged.

No schema or backup-format migration is required. Export a backup through dashboard Settings if recovery may be needed. Import merges records by ID and can restore deleted companies, old references, or pre-cleanup role/location values. See [Backup and restore](backup-restore.md) and [Circles and tags](folders-tags.md) for their respective contracts.

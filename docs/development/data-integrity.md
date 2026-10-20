# Data integrity and development plan

Contexto's contact database must survive feature work and schema evolution without silently discarding user-authored values. Local persistence is not an external backup and does not survive every uninstall, profile deletion, or device failure.

## Implementation plan and status

The initial integrity hardening implements these protections:

1. **Preserve model history.** Upgrade database versions 1–3 to version 4 without deleting legacy fields. Derive a missing role from position and profession while retaining both original values. Keep an existing role authoritative. Normalize old account records on backup import too. Previously deleted values cannot be reconstructed without an older backup.
2. **Make saves atomic.** Profile upsert, notes, tag/circle assignment, dashboard metadata plus pending assignments, bookmarks, and management operations use transactions. Check ownership inside the transaction. Failures roll back the full operation.
3. **Export consistent, complete snapshots.** Read every current database table in one transaction. Preserve whole records, including fields unknown to the current UI. A regression compares exported table coverage against the actual schema.
4. **Validate imports and make restore deliberate.** Check required tables, record types, timestamps, normalized identity, duplicate keys, and references before writing. Safe merge refuses conflicting records and identities. Full restore atomically replaces the database. The dashboard previews counts, requires a recovery-file download and verification, and rejects previews made stale by other writes.
5. **Protect drafts across surfaces.** Dashboard, X profile, and feed grouping drafts retain a contact revision alongside the shared-catalog revision. Compare the baseline inside the write transaction, retain failed drafts, and offer explicit reload. Revisions include persisted fields and assignments rather than relying on millisecond timestamps.
6. **Require preservation regressions.** `npm run test:integrity` runs the focused integrity checks. `npm run check` runs type checking, the complete test suite, a release build, and popup bundle verification. `npm run verify:integrity` additionally exercises the built extension in temporary Chromium storage.

## Rules for future model and feature changes

- Adding an optional unindexed field usually needs no Dexie version bump. Test that old records lacking it still load, ordinary edits preserve it, and JSON round trips retain it.
- Table/index changes require a new Dexie version. Field renames or transformations need an explicit lossless migration. Retain original values when a conversion is ambiguous; never repurpose a field silently.
- Update migration fixtures for every supported source version and retain coverage of prior versions. Test creation dates, stable IDs, notes, assignments, and unknown fields alongside the new feature.
- Keep the backup table list, export, validation, and restoration synchronized when introducing a table. Change the backup format if old code could misinterpret the new structure. Reject unsupported tables/versions rather than silently dropping their contents.
- Use narrow patches for direct actions and contact revision checks for saves based on a loaded draft. Repository revision parameters remain optional for direct operations without a draft; every production draft editor must pass its baseline, including an empty baseline for an unsaved contact.
- Multi-record mutations must share one transaction, including their change-log writes. Check referenced records in that transaction. Inject a late failure in a regression and verify the pre-operation graph is unchanged.
- Recovery logs contain event metadata, not previous record values. Do not describe the change log or `backups` table as an undo mechanism.
- Export a JSON file before deploying a schema change to a profile with valuable data. Reload the existing extension installation in the same persistent browser profile. Avoid uninstall/reinstall and profile deletion as development steps. Older builds may not open a newer schema; use a separate disposable profile for downgrade tests.

## Recovery and remaining work

The current recovery workflow is a JSON copy saved outside the extension/browser profile. Full restore imports it into a fresh or existing installation. Settings and Quick X search preferences remain separate; see [Backup and restore](../features/backup-restore.md).

Automatic external backups remain planned. They need a chosen user-controlled destination (for example, a selected filesystem folder or an authenticated remote service), retention/versioning, visible last-success and failure status, and a restore drill. They must not silently export relationship data or claim success merely because a download was requested. A second snapshot stored inside the extension alone cannot protect against uninstall or device loss.

Before treating automated backup as complete, verify restore into a fresh browser profile with actual downloaded files. Cloud synchronization is a separate feature: it also needs conflict and deletion rules and does not replace versioned backups.

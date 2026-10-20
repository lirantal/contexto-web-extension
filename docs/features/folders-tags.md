# Feature: Folders And Tags

Tags and folders are both many-to-many account groupings.

Use tags for descriptors such as `security`, `oss`, `speaker`, or `community-leader`.

Use folders for relationship groups such as `DevRel friends`, `Conference follow-up`, or `Potential podcast guests`.

The MVP supports creating, assigning, and removing tag/folder assignments from both the X overlay and the dashboard. Dashboard removals persist immediately; the X editor persists its complete selection when the account context is saved. Removing an assignment keeps the shared tag or folder available for other accounts and future use.

Saving context in any X editor or selecting **Save metadata** in the dashboard also saves non-empty text still in the Tags and Folders inputs, even if it has not been added as a chip. Pending values are trimmed and existing assignments are reused without duplicates. Failed saves retain unsaved input for retry; Cancel in an X editor discards pending input along with the rest of the draft.

## Manage shared values

Open **Manage data** from the dashboard to manage **Tags** and **Folders** in the current browser profile. Companies and free-text metadata are outside this first release.

Each searchable table shows all active definitions, including unused values, and the number of active contacts using each one. Sort by name or most contacts, filter **Unused only**, or select **View contacts** for an affected-contact preview.

- **Rename** changes the shared name while preserving its ID and all assignments. Names are trimmed, internal whitespace is collapsed, and blank names are rejected. Case-insensitive normalized-name collisions offer **Merge into** the existing value.
- **Merge** moves assignments into an existing destination, deduplicates overlapping assignments, and permanently deletes the source definition and its original joins. The preview includes the combined unique-contact count.
- **Delete** requires confirmation showing the affected-contact count. **Delete tag everywhere** or **Delete folder everywhere** permanently removes the definition and all its joins, including joins for inactive contacts. Contacts and other saved data remain intact. Cancel performs no writes.

Each operation is one IndexedDB transaction, including account timestamps, sync flags, and change-log entries. A failed operation leaves the database unchanged and the action available for retry. A concurrent catalog edit invalidates an older management form; cancel and reopen that action before retrying. Live dashboard filters discard removed IDs while preserving the query and remaining selections, so removed IDs cannot leave results hidden.

Export a backup through dashboard Settings if you need a recovery copy. Imports merge by ID, so importing an older backup can restore removed values.

## Open editors and catalog changes

Account summaries and lookup data include a catalog revision. X profile drafts retain the revision they originally loaded, including across remounts; the feed grouping editor retains its account snapshot revision. Rename, merge, and global deletion invalidate earlier revisions. Saving a stale draft rejects before any writes, preserving the draft and keeping the editor open so removed names cannot silently be recreated.

Use **Reload saved values** after a failed save to explicitly discard the draft and load current metadata/assignments before retrying. In a profile editor, Cancel retains the established close behavior. The revision is derived from catalog mutation entries in the existing change log and survives backup/restore; ordinary assignment edits do not invalidate other editors.

The saved-contact feed badge popup also supports **Edit tags and folders** without opening the full editor. Its explicit **Save tags and folders** writes assignments only, includes pending input, and keeps the popup open. Cancel or panel dismissal discards unsaved grouping edits. See [Saved-contact feed context](feed-saved-contact-context.md).

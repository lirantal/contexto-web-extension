# Feature: Folders And Tags

Tags and folders are both many-to-many account groupings.

Use tags for descriptors such as `security`, `oss`, `speaker`, or `community-leader`.

Use folders for relationship groups such as `DevRel friends`, `Conference follow-up`, or `Potential podcast guests`.

The MVP supports creating, assigning, and removing tag/folder assignments from both the X overlay and the dashboard. Dashboard removals persist immediately; the X editor persists its complete selection when the account context is saved. Removing an assignment keeps the shared tag or folder available for other accounts and future use.

Saving context in any X editor or selecting **Save metadata** in the dashboard also saves non-empty text still in the Tags and Folders inputs, even if it has not been added as a chip. Pending values are trimmed and existing assignments are reused without duplicates. Failed saves retain unsaved input for retry; Cancel in an X editor discards pending input along with the rest of the draft.

Rename and global delete management can be added as follow-up dashboard actions.

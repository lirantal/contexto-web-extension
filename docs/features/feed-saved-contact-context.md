# Feature: Saved-Contact Feed Context

Contexto augments supported X feed posts when the primary author already exists in the local Contexto database. A small Contexto marker appears in the validated author header. Activating it opens or closes a compact relationship panel with saved context and explicit actions without triggering the enclosing X post's navigation. Intentional links inside the panel retain their own navigation behavior.

**Panel organization.** Saved context, local writes, outbound X links, checkpoint controls, and full context are presented as separate groups. Both X links are colocated before the checkpoint row.

## Eligibility

The feed integration only considers top-level, non-promoted post roots. Identity extraction is scoped to the candidate post and requires a coherent normalized `@handle` plus an exact `/<handle>` profile link in the same author subtree. Quoted-post authors, reply targets, mentions, promoted posts, ambiguous markup, and unknown accounts receive no Contexto UI.

Contexto never creates an account from feed visibility. It performs an ephemeral local account lookup and renders the marker only when a saved `AccountSummary` is returned.

When the primary post also has one validated canonical status URL, the panel checks the saved contact's bookmark collection. It offers **Capture this post** for uncaptured items or shows disabled **Bookmarked** state for duplicates. Available local actions share a two-column row, while a lone action spans the full row. Opening either composer replaces the complete local-action row, including the saved **Bookmarked** state. Capture uses an inline optional-reminder composer; invalid post evidence or bookmark lookup failure hides capture while preserving relationship context.

When the saved `myXHandle` setting and author handle are both valid, the panel also shows **View our interactions**. It opens a new tab with X's live results for `(from:viewer to:author) OR (from:author to:viewer)`. Missing, invalid, or unavailable settings hide only this shortcut.

Every saved X author with a valid handle can also show **Catch up on X**. This opens their live posts since the account's explicit catch-up checkpoint, or their complete author search before the first checkpoint. **Mark caught up** is a separate action so opening a search never claims that the results were reviewed.

Every saved contact also offers **Add quick note**, independent of whether the surrounding feed item has a valid bookmarkable post. It opens an inline relationship-note composer without creating or linking a bookmark.

## Summary contents

The saved relationship summary omits empty fields and may show:

- Display name.
- Role and company.
- Relationship source.
- Tags and folders.
- Latest note.

**Open full context** delegates to the existing Contexto-owned profile editor. **View our interactions** performs outbound navigation only. Opening or reading the compact panel does not write data.

**Catch up on X** also performs outbound navigation only. A catch-up timestamp is written only after explicit **Mark caught up**, and a failed write preserves the prior checkpoint.

**Add quick note** does not write until a non-empty draft is explicitly saved. During Save its controls are disabled. Success closes the composer, clears the draft, confirms the write, and refreshes the displayed latest note from the authoritative saved account. Failure preserves the draft for retry. **Cancel** or closing the feed panel discards an unsaved quick note.

Quick-note and bookmark composers are mutually exclusive so the compact panel holds at most one unsaved draft.

## Lifecycle and privacy

Feed posts are transient and may be recycled by X. Contexto tracks the post host plus normalized author identity, removes stale mounts when identity changes, and cleans disconnected mounts. The marker is inserted in normal flow within the validated author header and is isolated in a Shadow DOM host.

The normalized handle is sent for account lookup. Contexto reads its own local settings to build an eligible interaction-search URL; the shortcut does not infer the signed-in identity from X DOM or persist a search-history record. For eligible saved contacts only, Contexto may additionally send the canonical post URL and a bounded top-level text excerpt through the local message boundary after explicit capture. It does not store engagement data, media, quoted content, or the visible set of unknown accounts.

Quick-note text crosses the local content-script/background boundary only after explicit Save and is stored as an ordinary manual account note. It is not coupled to the visible post or its contents.

Feed context does not support bookmark editing, interaction scoring, feed filtering, or content analysis.

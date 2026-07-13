# Feature: Saved-Contact Feed Context

Contexto augments supported X feed posts when the primary author already exists in the local Contexto database. A small Contexto marker appears in the validated author header. Activating it opens a compact, read-only relationship summary with an **Open full context** action.

## Eligibility

The feed integration only considers top-level, non-promoted post roots. Identity extraction is scoped to the candidate post and requires a coherent normalized `@handle` plus an exact `/<handle>` profile link in the same author subtree. Quoted-post authors, reply targets, mentions, promoted posts, ambiguous markup, and unknown accounts receive no Contexto UI.

Contexto never creates an account from feed visibility. It performs an ephemeral local account lookup and renders the marker only when a saved `AccountSummary` is returned.

When the primary post also has one validated canonical status URL, the panel checks the saved contact's bookmark collection. It offers **Capture this post** for uncaptured items or shows disabled **Bookmarked** state for duplicates. Capture uses an inline optional-reminder composer; invalid post evidence or bookmark lookup failure hides capture while preserving relationship context.

When the saved `myXHandle` setting and author handle are both valid, the panel also shows **View our interactions**. It opens a new tab with X's live results for `(from:viewer to:author) OR (from:author to:viewer)`. Missing, invalid, or unavailable settings hide only this shortcut.

## Summary contents

The read-only panel omits empty fields and may show:

- Display name.
- Role and company.
- Relationship source.
- Tags and folders.
- Latest note.

**Open full context** delegates to the existing Contexto-owned profile editor. **View our interactions** performs outbound navigation only. Opening or reading the compact panel does not write data.

## Lifecycle and privacy

Feed posts are transient and may be recycled by X. Contexto tracks the post host plus normalized author identity, removes stale mounts when identity changes, and cleans disconnected mounts. The marker is inserted in normal flow within the validated author header and is isolated in a Shadow DOM host.

The normalized handle is sent for account lookup. Contexto reads its own local settings to build an eligible interaction-search URL; the shortcut does not infer the signed-in identity from X DOM or persist a search-history record. For eligible saved contacts only, Contexto may additionally send the canonical post URL and a bounded top-level text excerpt through the local message boundary after explicit capture. It does not store engagement data, media, quoted content, or the visible set of unknown accounts.

Feed context does not support bookmark editing, interaction scoring, feed filtering, or content analysis.

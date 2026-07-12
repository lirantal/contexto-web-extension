# Feature: Saved-Contact Feed Context

Contexto augments supported X feed posts when the primary author already exists in the local Contexto database. A small Contexto marker appears in the validated author header. Activating it opens a compact, read-only relationship summary with an **Open full context** action.

## Eligibility

The feed integration only considers top-level, non-promoted post roots. Identity extraction is scoped to the candidate post and requires a coherent normalized `@handle` plus an exact `/<handle>` profile link in the same author subtree. Quoted-post authors, reply targets, mentions, promoted posts, ambiguous markup, and unknown accounts receive no Contexto UI.

Contexto never creates an account from feed visibility. It performs an ephemeral local account lookup and renders the marker only when a saved `AccountSummary` is returned.

## Summary contents

The read-only panel omits empty fields and may show:

- Display name.
- Role and company.
- Relationship source.
- Tags and folders.
- Latest note.

**Open full context** delegates to the existing Contexto-owned profile editor. Opening or reading the compact panel does not write data.

## Lifecycle and privacy

Feed posts are transient and may be recycled by X. Contexto tracks the post host plus normalized author identity, removes stale mounts when identity changes, and cleans disconnected mounts. The marker is inserted in normal flow within the validated author header and is isolated in a Shadow DOM host.

Only the normalized handle is sent through the existing local extension message boundary for lookup. Contexto does not read or store post text, post URLs, engagement data, or the visible set of unknown accounts.

Feed context currently does not support post capture, editing, interaction scoring, feed filtering, or content analysis.

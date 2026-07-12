# Feed Saved-Contact Context Design

**Date:** 2026-07-12

## Summary

Contexto will recognize authors of ordinary X feed posts who are already saved locally and add a small Contexto marker to those posts. Activating the marker opens a compact, read-only relationship summary with one action: **Open full context**. Unsaved authors receive no Contexto UI.

This first slice tests whether saved relationship context is useful while reading the feed. It does not analyze posts, create accounts, write CRM data, score relationships, or augment unknown authors.

## Goals

- Make existing relationship context available at the moment a saved person's post is read.
- Keep the feed quiet by rendering only for locally saved X accounts.
- Reuse the existing account lookup, account summary, owned editor, runtime sender, and Shadow DOM styling boundaries.
- Establish a reliable, testable feed-post extraction and mounting boundary that later feed features can extend.
- Remain safe under X's transient, virtualized, versionless DOM.

## Non-goals

- Saving an unknown post author.
- Capturing a post as a note.
- Editing metadata inside the compact feed summary.
- Analyzing, summarizing, ranking, or storing post content.
- Calculating engagement or relationship scores.
- Highlighting or filtering the feed.
- Augmenting quoted-post authors, reply targets, mentioned accounts, promoted content, or non-post user cells.
- Bulk-scanning or persisting the set of accounts visible in the feed.

## User Experience

For a top-level, non-promoted feed post whose primary author is already saved in Contexto, Contexto adds a compact button labeled with the Contexto mark and a short saved-state cue. It sits in the post author's header area without replacing or covering X controls.

Activating the button reveals a Contexto-owned compact panel containing:

- Display name.
- Role and company when present.
- Relationship source when present.
- Tags and folders when present, constrained to a compact layout.
- Latest note text when present.
- An **Open full context** button.

Empty fields are omitted. The panel is read-only and does not write data merely by opening. **Open full context** launches the existing Contexto-owned full editor for the extracted primary-author profile. The marker toggles the compact panel. An outside pointer interaction or Escape closes it, while interaction inside it does not. It is not an editor and does not inherit the persistent editor close contract.

Loading, unsaved, ambiguous, and lookup-error states render no marker. This deliberately prefers a silent feed over placeholder, retry, or error UI repeated across many posts.

## Identity and Eligibility

Feed markup is treated as transient, untrusted input. A dedicated feed-post extractor receives one candidate post root and returns either a primary-author `ProfileSnapshot` or no result.

The extractor must:

- Scope every query to that candidate post root.
- Identify the post's primary author from a coherent identity subtree containing a normalized `@handle` and an exact `/<handle>` profile link.
- Read the display name from the same identity subtree.
- Exclude identities belonging to quoted posts, reply targets, mentions, social-context labels, avatars outside the primary author subtree, and nested cards.
- Reject promoted posts for this first slice.
- Return no profile when evidence is missing or inconsistent.
- Avoid reading or retaining post body text.

Eligibility requires both a valid extracted X profile and a successful local lookup returning an existing account. The content script must not call `ensureAccountFromProfile` or otherwise persist the visible author.

## Observation and Mounting Architecture

The existing X surface observer will be extended through a distinct feed-post observation path rather than treating posts as profile or hover-card surfaces. The observer finds candidate post roots, invokes the feed extractor, and mounts at most one feed context control per eligible primary author/post pair.

Observation and mounting responsibilities remain separate:

1. The observer discovers a candidate post and asks the extractor for identity evidence.
2. A feed controller performs `contexto:account:lookup` for the normalized handle.
3. When the lookup returns a saved account, the controller resolves an in-flow insertion point within the primary-author header.
4. A dedicated feed mount creates a Contexto-owned Shadow DOM host and renders the marker and compact panel.
5. The existing page editor controller opens full context when requested.

The feed control receives the lookup result so it does not repeat the account request after mounting. Feed UI must not reuse `ContextoHoverLauncher` directly because that component displays unsaved and error states and launches directly into editing. Shared presentational summary pieces may be extracted only when doing so keeps hover-card behavior unchanged.

The mount identity includes the post host and normalized primary-author handle. If X recycles a connected post node for a different author, Contexto cleans up the old mount before considering the new identity. Disconnected post hosts and orphaned mount hosts are cleaned up. Mutation processing remains debounced and idempotent.

## Placement

The marker is inserted in normal flow within the primary-author header at a location resolved relative to the validated identity subtree. Placement must not rely on global coordinates, fixed positioning, or the first matching link in the post.

If no safe in-flow insertion point can be resolved, Contexto renders nothing for that post. A newly observed X layout requires a minimal fixture and an explicit placement regression test before adding a fallback.

## Data Flow and Privacy

The feature uses the existing `contexto:account:lookup` request and `AccountSummary` response. No schema, repository, backup, import, permissions, or host-permission change is required.

Data flow is:

`visible post identity -> normalized handle -> local background lookup -> saved AccountSummary -> ephemeral feed UI`

Neither the post URL nor post text is sent to the background worker or stored. Unknown handles are used only for an ephemeral lookup and are not persisted. All relationship data remains local under the existing security model.

## Error and Lifecycle Behavior

- Extraction ambiguity: render nothing.
- Promoted post: render nothing.
- Unsaved author: render nothing.
- Lookup rejection or extension runtime invalidation: render nothing and avoid an unhandled rejection.
- Unsafe or missing insertion point: render nothing.
- Repeated mutation for the same connected post and author: do not repeat lookup or mounting work.
- Recycled post host with changed identity: remove stale UI and perform eligibility for the new identity.
- Disconnected host: unmount React and remove the Shadow DOM host.
- X navigation or content-script invalidation: close feed panels and clean up all feed mounts through the existing lifecycle.

Each compact panel has local disclosure state; coordinating expanded state across separate posts is outside this slice. The existing owned full editor retains its documented close contract after **Open full context** is selected.

## Testing

### Extractor fixtures

Add minimal X fixtures and regression tests for:

- A standard top-level post with one coherent primary-author identity.
- A post containing a quoted post, proving the quoted author is not selected.
- A reply containing a reply target, proving the reply target is not selected.
- A promoted post, proving it is rejected.
- A post containing inconsistent handle/link evidence, proving extraction fails closed.

### Observer and lifecycle tests

Assert that:

- A saved author receives one marker.
- An unsaved author receives no marker.
- Repeated mutations do not duplicate the marker or repeat settled lookup work.
- A recycled connected post host removes stale UI and evaluates the new author.
- A disconnected post cleans up its React and DOM mount.
- Runtime lookup failures remain silent.

### Component and placement tests

Assert that:

- The collapsed marker is keyboard accessible and exposes its expanded state.
- The compact panel renders only available account fields.
- The panel is read-only.
- **Open full context** sends the validated profile to the existing editor controller.
- The mount is in normal flow at the validated author-header insertion point.
- Existing X action controls are not replaced or covered.

### Regression and manual verification

Run the complete automated suite plus compile, production build, and popup verification. Manually verify Home, Following, profile timelines, search results, and a narrow viewport in both Chrome and Vivaldi. Confirm standard, reply, quoted, and promoted posts; virtualized scrolling; theme compatibility; and clean behavior after extension reload and X navigation.

## Delivery Boundaries

This slice is complete when saved authors on supported top-level feed posts receive one reliable, read-only Contexto marker and compact summary, unknown or ambiguous authors receive no UI, and full context opens through the existing editor. Capture-as-note, quick actions, interaction shortcuts, feed highlighting, and local insight signals remain separate follow-up increments.

# Inline X Context Design

> **Superseded interaction note (2026-07-11):** The hover-card editor and post-save summary decisions in this historical design are replaced by `2026-07-11-x-editor-and-popup-qa-fixes-design.md`. Hover cards now launch a persistent right-rail/modal editor, and successful saves keep the complete editor visible.

## Summary

Contexto will move from a fixed profile-page overlay to native-feeling, inline integrations inside X. The first release covers two X surfaces:

- User hover cards opened from avatars or usernames in feeds and other X views.
- Full X profile pages.

Both surfaces use the same Contexto summary and metadata editor. Contexto never creates or changes an account merely because a user hovers over a profile or opens a profile page. Saving is always an explicit action.

## Goals

- Keep users inside their current X feed or profile context while viewing and editing relationship information.
- Show the highest-value saved context without overwhelming X's existing interface.
- Allow a previously unknown X account to be saved through a complete inline form.
- Prefill information that X already exposes, especially display name and handle.
- Give tags and folders distinct but functionally and visually consistent controls.
- Reuse Contexto's local-first data model, background boundary, and IndexedDB repositories.
- Replace the fixed X profile-page overlay with an integrated profile-page section.
- Remain usable across X's single-page navigation and frequent DOM remounts.

## Non-Goals

- Integrating Contexto into every X menu or surface in this release. The hover card and full profile page establish the reusable integration foundation.
- Opening the dashboard, extension popup, or a separate window for routine profile capture and editing.
- Automatically inferring profession, position, company, relationship source, tags, or folders from a biography.
- Persisting drafts across browser or tab reloads.
- Synchronizing Contexto data to a remote service.
- Recreating or replacing X's own hover-card content.

## Approved Experience

### Unsaved account

When Contexto finds no existing account for the normalized X handle, it appends a clearly branded section to the X surface and shows the full metadata editor immediately. The section displays a `Not saved` state.

The editor contains:

- Display name.
- X handle, shown as read-only identity information.
- Position.
- Profession.
- Company.
- Location.
- How you know them.
- Tags.
- Folders.

Display name and handle are prefilled from the current X surface. The extracted snapshot may also carry avatar URL, profile URL, biography, and visible X location for internal capture and prefill. These extracted values are not written to the database before the user clicks **Save to Contexto**.

Tags and folders are separate multi-value fields. Both fields use the same interaction model and visual language:

- Search existing values.
- Select multiple values.
- Remove a selected value.
- Create a new value inline when no existing value matches.

The two fields remain separately labeled and persist to their respective tag and folder entities and relationships.

### Explicit save

**Save to Contexto** sends the profile snapshot, metadata fields, selected tags, and selected folders as one compound request. Hovering, opening the editor, and changing draft fields cause no persistent writes.

While saving:

- The save action is disabled to prevent duplicate requests.
- The form remains visible.
- A screen-reader status message announces progress.

On success, the editor collapses to the saved priority summary. On failure, the draft remains intact and an inline error with a retry action appears.

### Saved account

The default Contexto section shows a compact priority summary:

- Saved display name.
- Position and company, presented as one concise role line when both exist.
- Tags.

Missing values are omitted rather than rendered as empty rows. Folders and the remaining metadata are available through **Edit**, but are not part of the default compact summary.

Selecting **Edit** opens the complete inline form. **Save** persists the changes and restores the compact summary. **Cancel** restores the last persisted values and discards the current draft.

Changing X-derived data must not silently overwrite user-edited Contexto metadata. Existing saved metadata is authoritative. Extracted X values may prefill missing draft values but require an explicit save to persist.

### Hover-card lifecycle

X hover cards are transient. Contexto keeps an in-memory draft keyed by normalized X handle while the user is editing. If X removes and recreates the hover card, Contexto restores that draft when the same account surface returns.

The draft is cleared when any of the following occurs:

- The save succeeds.
- The user cancels editing.
- Navigation establishes a different page context.
- The tab reloads or closes.

Interacting with Contexto controls must count as interaction with the hover-card experience. Focus and pointer handling should prevent Contexto's own controls from immediately triggering cleanup. Contexto cannot guarantee that X will never remove its card, so remount recovery is required in addition to interaction handling.

### Full profile page

The full profile page uses the same shared Contexto component, states, validation, and persistence flow as the hover card. It is inserted into X's profile content rather than fixed to the browser viewport. The current standalone `ProfilePanel` overlay is retired after the integrated profile surface is validated.

The profile-page host can provide more width than a hover card, but it must not introduce a separate feature set or data flow. Responsive styles adapt the shared component to the available host width.

## Architecture

### Integration strategy

Contexto uses DOM augmentation with isolated React mounts. A content-script surface observer discovers supported X surfaces, extracts a surface-scoped profile snapshot, creates an insertion host inside that surface, and mounts the shared Contexto component.

Each mount uses Shadow DOM or an equivalent WXT isolated UI boundary. This prevents X styles from breaking form controls and prevents Contexto styles from leaking into X. The visible design still follows X's current spacing, typography scale, border treatment, and light/dark color context.

Anchored overlays were rejected because they would not provide the approved fully inline experience. Direct light-DOM rendering was rejected because it would create unnecessary bidirectional CSS coupling with X.

### Module boundaries

The content integration is divided into focused units:

1. `XSurfaceObserver` watches for candidate surfaces, throttles mutation processing, mounts each surface once, and unmounts removed surfaces.
2. Hover-card and profile-page detectors identify supported host elements using stable attributes and conservative structural checks.
3. Surface extractors derive `ProfileSnapshot` values only from their specific host. They do not query unrelated profile data elsewhere in the document.
4. `ContextoProfileSurface` owns lookup, editor/summary state, validation, status feedback, and persistence requests.
5. Tag and folder multi-select controls share a generic interaction implementation but receive distinct labels, values, and persistence keys.
6. An in-memory draft store preserves unsaved edits by normalized handle across transient remounts.
7. The background message handler and repositories own all persistent reads and writes.

The content script remains unable to access IndexedDB repositories directly.

### Surface detection and cleanup

A single throttled `MutationObserver` processes relevant DOM additions and removals. It must avoid running a full-document extraction on every mutation. Candidate elements receive a Contexto-owned mount marker or are tracked in a `WeakMap` so repeated observation cannot create duplicate sections.

Each mounted surface has an explicit cleanup function that unmounts React and removes Contexto's host when X removes the underlying surface. The observer is also disconnected when the content-script context is invalidated.

Detectors prefer stable `data-testid`, role, link, and URL signals over generated class names. Multiple conditions should identify a surface so an unrelated X dialog is not modified accidentally.

### Read and write contracts

The existing `contexto:account:getByHandle` request remains the read-only lookup path. Surface initialization must use this lookup rather than `contexto:account:ensure`.

A new compound request will represent an explicit save. Its input includes:

- The captured `ProfileSnapshot`.
- Editable account metadata.
- The complete selected tag-name set.
- The complete selected folder-name set.

Its response returns the resulting `AccountSummary`.

The old ensure operation may remain for compatibility with existing callers during migration, but the inline X surfaces must not call it during lookup. Once no caller depends on implicit ensure semantics, it can be removed or renamed in a later cleanup.

### Transactional persistence

The compound save executes in a Dexie transaction covering accounts, companies, tags, folders, account-tag relationships, folder-account relationships, and change-log entries.

For a new account, the transaction creates the account only after the explicit save request. For an existing account, it updates the permitted metadata. Company resolution follows the existing normalized-name behavior.

Tag and folder selections are synchronized as complete sets:

- Create or reactivate referenced tag and folder records as needed.
- Add missing relationships.
- Remove relationships no longer selected in the submitted editor.
- Do not delete the global tag or folder entity merely because it was removed from one account.

If any part fails, the transaction rolls back and the UI retains its draft.

## Data Flow

1. X inserts or updates a supported surface.
2. The observer identifies the candidate and asks the matching extractor for a profile snapshot.
3. If extraction does not produce a valid handle and profile URL, Contexto does not mount.
4. Contexto mounts once and requests the saved account by normalized handle.
5. A found account renders the compact summary. A missing account renders the prefilled full editor without creating data.
6. The user edits fields locally. Lookup data supplies existing tags and folders.
7. The user explicitly saves.
8. The background handler validates the request and executes the compound repository transaction.
9. The returned `AccountSummary` becomes the authoritative UI state and the draft is cleared.

## Validation and Error Handling

- A valid normalized X handle and profile URL are required before saving.
- Display name falls back to the handle if X exposes no usable display name.
- Metadata values are trimmed and normalized using existing repository conventions.
- Empty optional values are stored consistently with the current account model.
- Tag and folder names cannot be blank after trimming.
- Duplicate tags or folders are prevented by normalized name and set semantics.
- Component-level failures remain inside the Contexto section and do not block X interaction.
- A failed detector or extractor logs a diagnostic message in development without injecting a partial UI.
- A failed lookup offers retry and does not assume the account is unsaved.
- A failed save leaves the editor and draft intact and permits retry.
- X markup changes must degrade to no Contexto mount rather than damaging or obscuring X controls.

## Accessibility and Theme Support

- Every field has a programmatic label.
- All actions and multi-select operations work by keyboard.
- Focus remains visible in X light and dark themes.
- Loading, save success, and errors use appropriate live-region announcements.
- Focus is restored predictably when cancelling or completing an edit.
- Colors meet contrast requirements and do not rely on color alone for state.
- Animations respect `prefers-reduced-motion`.
- The host surface's light or dark appearance maps to Contexto design tokens without importing X's private CSS.

## Testing Strategy

### Unit and component tests

- Extract snapshots from representative hover-card and full-profile DOM fixtures.
- Reject reserved routes, malformed profile links, and unrelated X dialogs.
- Render unsaved, loading, lookup-error, saving, save-error, saved-summary, and editing states.
- Verify that display name and handle prefill without causing a write.
- Verify separate tags and folders fields with equivalent search, selection, creation, and removal behavior.
- Verify priority-summary omission rules for missing metadata.
- Verify cancel restores persisted values.
- Verify draft restoration after a simulated remount.

### Observer lifecycle tests

- Mount when supported surfaces appear after initial page load.
- Prevent duplicate mounts during repeated mutations.
- Maintain independent mounts for multiple eligible transient surfaces if X presents them.
- Unmount and clean up when X removes a surface.
- Re-evaluate correctly across X single-page navigation.
- Avoid mounting on unsupported surfaces.

### Repository and message tests

- Prove account lookup is read-only for missing and existing accounts.
- Create an account only through the compound explicit-save request.
- Update metadata without overwriting unrelated saved values.
- Add, retain, and remove tag relationships as a complete submitted set.
- Add, retain, and remove folder relationships independently as a complete submitted set.
- Roll back all writes when any compound-save step fails.
- Return the complete saved `AccountSummary`.

### Manual browser validation

Validate unpacked development builds in Chrome and Vivaldi on:

- Home feed hover cards opened from an avatar and a username.
- Search-result hover cards.
- Notification hover cards.
- Full profile pages reached directly and through SPA navigation.
- Saved and unsaved accounts.
- Light and dark X themes.
- Keyboard-only editing.
- Hover-card removal and recreation while a draft exists.

## Rollout and Compatibility

Implementation should introduce the new observer, extractors, shared surface, and explicit-save contract behind focused modules. The existing fixed profile overlay remains available only during development until both integrated surfaces pass automated and manual validation. It is then removed in the same implementation before release, preventing two editors from appearing on full profile pages.

If X changes one detector, the other surface should continue to work. Detectors and fixtures must be small enough to update independently.

## Success Criteria

- Hovering an unknown account performs zero persistent writes.
- An unknown account can be completely saved without leaving the X surface.
- Display name and handle are prefilled from the correct hovered or viewed account.
- Tags and folders appear as distinct, equivalent multi-value fields and persist independently.
- A saved account shows the approved compact summary by default.
- Editing supports adding and removing all requested metadata, tags, and folders.
- The same interaction works inside hover cards and full profile pages.
- Contexto mounts once per supported X surface and cleans up without impairing X.
- The existing fixed profile overlay is retired.
- Automated tests and manual Chrome/Vivaldi validation cover the supported surfaces and lifecycle behavior.

# X Editor and Toolbar Popup QA Fixes Design

## Goal

Resolve the three QA regressions observed on current `main`:

1. Contexto's hover-card editor changes X's hover-card layout and disappears before the user can interact with it.
2. A successful profile-context save collapses the editor to a summary, hiding the metadata the user wants to keep visible and editable.
3. The toolbar popup opens as a blank white window after the target-handle autosuggest merge.

The resulting experience keeps hover-card augmentation compact, moves editing into Contexto-owned persistent UI, keeps editors visible after saves, and prevents production-only JSX failures from blanking the popup.

## Root Causes

### Transient hover-card ownership

`ContextoProfileSurface` currently renders the complete editor directly inside X's transient hover-card host. The content script has draft restoration after a remount, but it does not implement the pointer or focus retention promised by the earlier inline-X design. More importantly, X owns the hover-card dismissal lifecycle and its original interaction region. Appending a large form changes the card's dimensions without making Contexto a reliable participant in X's private hover state.

### Intentional post-save summary transition

`saveContext()` explicitly sets the shared profile surface to `summary` after a successful save. The component test and previous design both assert that behavior. The QA result is therefore an outdated product decision rather than a persistence failure.

### Classic JSX runtime regression

The WXT React configuration uses `jsxRuntime: 'classic'`. The autosuggest merge changed `entrypoints/popup/App.tsx` back to a named-only React import and introduced `src/ui/TargetHandleCombobox.tsx` with another named-only React import. The production bundle consequently emits calls to `React.createElement(...)` without a `React` binding. The popup fails before its first render, while Vitest passes because its transform path does not expose the production bundle defect.

## Approved Interaction Design

### Hover-card launcher

Hover cards no longer contain the metadata form. Contexto adds one compact row within the existing hover-card footprint:

- Contexto branding.
- A concise saved or unsaved status.
- An **Edit** button.

The row must not appreciably increase the hover card's height or reflow its primary profile content. It remains useful as an enrichment indicator, but it does not attempt to own the hover lifecycle. The button click is the only transition from X-owned transient UI to Contexto-owned editing UI.

For an unsaved account, the row uses `Not saved` as its status and the same **Edit** action. For a saved account, the status may show `Saved` without duplicating the complete metadata summary inside the hover card.

### Persistent page-level editor

Selecting **Edit** captures the hovered `ProfileSnapshot` in page-level Contexto state and opens the shared editor outside the hover card. Once opened, the editor remains mounted even if X removes or recreates the originating hover card.

At desktop widths, the editor is docked into X's existing right-rail region, alongside or in place of optional modules such as Search or Today's News. Contexto owns the docked host and its cleanup. It does not append the editor to the hover card or mutate X's original card dimensions.

When a usable right rail is absent, including narrow layouts, the same component renders in a Contexto-owned modal dialog. The fallback traps focus, closes with Escape or its close button, restores focus to the launcher when it still exists, and does not depend on X's hover state.

Opening a different account replaces the editor's active profile after protecting against accidental draft loss. This release uses a simple rule: if the current editor has no unsaved changes, switch immediately; if it has unsaved changes, keep the current editor open and require the user to cancel or save before opening another account. No multi-editor or tabbed workflow is introduced.

### Full profile page

The complete shared editor remains inline on full profile pages. A full-profile mount does not show the old compact saved summary. Lookup success renders the form populated from the persisted account or from the extracted profile snapshot when the account is unsaved.

### Save, cancel, and close behavior

On every successful save:

- The editor remains visible in its current inline, docked, or modal placement.
- The returned `AccountSummary` becomes authoritative.
- Every field is repopulated from that returned account.
- The in-memory draft is cleared because the displayed values are now persisted.
- A non-disruptive live-region confirmation announces `Saved to Contexto`.
- The primary action returns from `Saving…` to `Save changes`.

The editor does not collapse to a summary after save. Subsequent edits continue from the saved values.

**Cancel** restores the last persisted values and removes unsaved changes. On a full profile page it leaves the form visible. In the docked or modal editor it closes the editor after restoring persisted values. The explicit close control follows the same unsaved-draft protection rule as switching accounts.

## Component Architecture

### Surface-specific presentation

`ContextoProfileSurface` is split conceptually into two presentations that share one editor and one persistence model:

1. `ContextoHoverLauncher` performs lookup and renders the compact status/action row in an X hover-card host.
2. `ContextoProfileEditor` owns lookup-derived values, draft editing, saving, cancellation, status feedback, and the complete metadata form.

The page-level controller owns the active docked/modal profile and selects its placement based on the availability of a stable right-rail host. The full-profile observer mounts `ContextoProfileEditor` directly in the profile page. Both paths use the same request contracts and draft helpers.

This separation prevents a presentation prop from accumulating incompatible hover, inline, and page-level lifecycle rules in one large component.

### Observer and controller responsibilities

`XSurfaceObserver` continues discovering hover cards and full profile pages. Hover discovery mounts launchers only. Full-profile discovery mounts the editor inline.

A page-level Contexto controller is mounted once by the content script and exposes an `openEditor(profile, returnFocusTarget)` callback to hover launchers. It:

- Tracks the active profile snapshot.
- Tracks whether the editor is docked or modal.
- Locates and observes an eligible X right-rail host.
- Moves the Contexto-owned host between docked and modal placement when responsive layout changes remove or restore that rail.
- Keeps the React editor mounted across hover-card cleanup.
- Clears page-level editor state during content-script invalidation and X page-context navigation.

The controller does not access repositories directly. All reads and writes remain behind background messages.

### Draft ownership

The existing `AccountDraftStore` remains keyed by normalized handle. The shared editor records changes there and clears them after save or cancellation. Hover launcher lookup state does not create drafts.

For active page-level editing, dirty state is derived by comparing the current draft with the last persisted/editor baseline. That signal guards account replacement and closing. Drafts remain memory-only and are cleared on page-context navigation or content-script invalidation as before.

## Toolbar Popup Reliability

### JSX runtime correction

Every TSX module compiled under the classic JSX runtime must have an in-scope React binding. The popup app and target-handle combobox will restore/import that binding. The implementation must not change WXT back to the automatic runtime because the classic configuration was introduced to stabilize the content-script bundle.

### Failure containment

Autosuggest enrichment remains optional. Rejections while loading account suggestions, target history, or persisted popup settings must not prevent the base search form from rendering. The popup initializes from its defaults and upgrades each data source independently when available.

The popup root gains a small error boundary. An unexpected synchronous render failure displays a compact recovery state with a **Retry** action rather than an empty white popup. The boundary is a last resort; anticipated storage and IndexedDB failures are handled within the normal data-loading path.

### Production-bundle regression coverage

Component tests are retained, but they cannot prove that the WXT production transform has valid classic-JSX bindings. A build-level test or verification script must inspect the production popup entry as loaded by `popup.html` and fail when it contains unbound `React.createElement` calls. The check must validate the generated artifact rather than merely searching source imports.

## Data Flow

### Hover to docked editor

1. X inserts a hover card.
2. The observer extracts a surface-scoped `ProfileSnapshot` and mounts `ContextoHoverLauncher`.
3. The launcher performs the read-only account lookup and renders compact status plus **Edit**.
4. The user selects **Edit** while still inside the original hover-card interaction region.
5. The launcher calls the page controller with the snapshot and button element.
6. The controller selects right-rail or modal placement and mounts the shared editor.
7. X may remove the hover card; the editor remains because its host and state are page-level.
8. Lookup, editing, and explicit save use the existing background message contracts.

### Successful save

1. The editor sends `contexto:account:saveContext` with the profile and complete draft.
2. The background transaction persists metadata, tag relationships, and folder relationships.
3. The returned account replaces the editor baseline and displayed draft.
4. The editor stays open and announces success.

### Popup startup

1. The popup bundle evaluates with valid React bindings.
2. React immediately renders the default search form.
3. Settings, saved search state, account suggestions, and target history load independently.
4. Successful results update their corresponding state; failures leave defaults or empty suggestions in place.
5. An unexpected render exception is caught by the root error boundary.

## Error Handling and Accessibility

- Hover launcher lookup failure renders a compact retry affordance without expanding into the full form.
- Editor lookup and save failures remain inline, preserve the draft, and expose retry.
- A save cannot be submitted twice while in progress.
- Save success is announced through an `aria-live` status without moving focus or collapsing content.
- The modal fallback has dialog semantics, an accessible name, focus containment, Escape handling, and predictable focus restoration.
- The docked editor has a labeled region and a visible close control.
- Right-rail detection failure degrades to the modal fallback rather than suppressing editing.
- Popup enrichment failures do not blank or disable unrelated search controls.
- The popup error boundary exposes a readable error state and retry without leaking stack traces.

## Testing Strategy

### Component tests

- Hover launcher renders `Not saved` or `Saved` plus **Edit**, without form fields.
- Selecting **Edit** passes the correct profile and focus target to the page controller.
- Full-profile, docked, and modal editors render the same metadata fields.
- Successful save keeps the form visible, replaces values from the returned account, clears dirty state, and announces success.
- Cancel on a full profile restores values without hiding the form.
- Cancel or close on a page-level editor restores values and closes it.
- Failed lookup or save retains a usable retry path.
- Popup default content renders before asynchronous enrichment completes.
- Popup storage and IndexedDB rejections retain the base form.
- Popup error boundary renders recovery UI for unexpected render failures.

### Observer and controller tests

- Hover surfaces mount launchers rather than full editors.
- Clicking a launcher opens one page-level editor.
- Removing the originating hover card does not unmount the page-level editor.
- A stable right rail produces docked placement.
- Missing or removed right rail produces modal placement without losing draft state.
- Full profile navigation mounts the inline editor and clears stale page-level state.
- Duplicate mutation bursts do not create duplicate launchers or controllers.

### Production verification

- Run the complete Vitest suite.
- Run TypeScript compilation with `npm run compile`.
- Build the Chrome extension with `npm run build`.
- Run the generated-popup binding check against `.output/chrome-mv3/popup.html` and its entry chunk.
- Manually reload the unpacked extension and verify the popup in Chrome or Vivaldi.
- Manually verify a hover launcher, docked editor, modal fallback, full-profile form, successful save, and hover-card dismissal.

## Approaches Considered

### Docked right-rail editor with modal fallback — selected

This removes the editor from X's transient ownership while preserving the browsing context. It avoids the large hover-card shift and continues working after dismissal. The modal fallback keeps editing available at narrow widths.

### Contexto-owned modal only

This is reliable and simpler to place, but it interrupts browsing on every edit and wastes the available desktop right rail. It remains only as the responsive fallback.

### Retained editor inside the hover card

Adding pointer/focus interception and remount recovery could improve the current experience, but it still depends on X's private lifecycle and still changes the card's dimensions. It was rejected as the primary design.

## Non-Goals

- Reverse-engineering or patching X's internal hover-dismissal timers.
- Supporting multiple simultaneous docked editors.
- Persisting unsaved drafts across tab reloads.
- Redesigning the popup search feature or removing autosuggest.
- Changing background persistence contracts or the local-first database model beyond what the always-visible editor requires.
- Adding a browser-native side panel permission or separate extension window.

## Success Criteria

- A user can click **Edit** from a Contexto hover row without traversing an expanded Contexto form.
- The resulting editor survives removal of the originating X hover card.
- Hover augmentation causes no large layout shift.
- Full-profile and page-level editors remain visible after successful saves and display the returned persisted values.
- Cancel semantics are consistent and do not unexpectedly collapse the full-profile form.
- The production toolbar popup renders its search UI instead of a blank window.
- Optional popup data failures leave the base search workflow usable.
- Automated component, lifecycle, and production-bundle checks cover all three regressions.

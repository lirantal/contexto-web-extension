# X Hover-Card Context Summary Design

## Problem

The compact Contexto launcher in X account hover cards has three related regressions:

1. X renders the Following and Followers links in a layout whose internal wrappers do not match the simplified test fixture. Mounting Contexto as a sibling of the inferred row lets X's flex layout place Contexto between the two counts.
2. X can dismiss and remove the hover card between pointer-down and the browser's later `click` event. The current Edit button opens the persistent editor only from `click`, so the handler can disappear before it runs.
3. The hover launcher reduces a successful account lookup to a saved/unsaved flag. It discards the returned `AccountSummary`, so saved metadata is unavailable to render.

Development extension reloads add a fourth lifecycle issue. An already-open X tab can retain a content script from the previous extension context. A later `browser.runtime.sendMessage` call may then throw `Extension context invalidated` synchronously, leaving stale UI and an uncaught extension error.

## Goal

Keep X's Following and Followers counts together, show Contexto immediately below both counts and before the mutual-followers content, make Edit reliably open the persistent editor, present useful saved metadata in the compact hover component, and handle stale extension contexts without uncaught errors.

## Hover Placement

The placement resolver continues to identify the current account's Following and Followers links semantically from these paths:

- `/<handle>/following`
- `/<handle>/followers`
- `/<handle>/verified_followers`

When both links are present, the resolver finds their nearest shared container and mounts the Contexto host as that container's final child. The host is a full-width flex item (`flex: 0 0 100%`) so it begins on a new visual line after both native links. It does not become a sibling that X can interleave with the count links.

The resolver accepts this placement only when the shared container is a focused descendant of the hover card's profile-content subtree. If it cannot identify a safe count container, it retains the existing non-overlapping in-flow fallback before the profile CTA or at the end of the inner content container.

The intended order is:

```text
1,470 Following   35.3K Followers

◆ Contexto        Saved          Edit
Display Name
Profession · Company
[Tag] [Tag]

Followed by …
[ View Profile ]
```

## Edit Interaction

Pointer interaction opens the persistent editor during pointer-down, before X can dismiss and remove the hover card. The launcher records that activation so the subsequent click does not open the editor twice.

The regular click handler remains available for keyboard and assistive-technology activation, where no pointer-down occurs. The persistent editor remains mounted in the existing right rail or modal fallback, independently of the hover-card lifecycle.

The launcher does not cancel X's global hover behavior or synthesize hover events.

## Saved Metadata Summary

The launcher stores the complete `AccountSummary` returned by lookup rather than only a `saved` state. A saved account renders a compact, read-only summary below the launcher header:

- Display Name is always shown, using the saved account value.
- Profession is shown only when populated.
- Company is shown only when populated.
- Profession and Company share one concise line separated by a middle dot when both exist.
- Tags are shown only when populated, using compact chips.
- Empty values are omitted.

Position, location, relationship source, folders, and notes remain available in the persistent editor but are omitted from the hover summary to control card height. Unsaved accounts retain the compact Not saved status and Edit action without placeholder metadata rows.

## Invalidated Extension Contexts

Content-script runtime messaging moves behind a safe sender created inside the WXT content-script `main` lifecycle. Before messaging it checks the WXT context's validity. It also converts synchronous `browser.runtime.sendMessage` throws into rejected promises so React effects can follow their existing error paths instead of producing uncaught errors.

When the WXT context is invalid, checking validity triggers the registered invalidation cleanup. The surface observer, persistent editor, and draft store are disconnected or cleared, removing stale Contexto UI from the page. The extension cannot reconnect an old content script to a newly loaded runtime, so reloading an already-open X tab after reloading the extension remains required.

Non-invalidation messaging failures retain the existing compact unavailable/retry behavior.

## Components and Data Flow

1. `entrypoints/content.ts` creates a lifecycle-aware `send` function for the active WXT context.
2. The X surface observer extracts the hover profile and mounts the launcher.
3. The placement resolver locates the shared count container and returns an insertion target inside it.
4. `ContextoHoverLauncher` looks up the account and retains the returned `AccountSummary`.
5. The launcher renders saved metadata when available.
6. Pointer-down or accessible click calls the page editor controller before the hover mount disappears.
7. The controller renders the existing complete editor in the right rail or modal fallback.

## Testing

Automated regression coverage will verify:

- the mount host becomes the final child of the shared count container;
- the host cannot appear between Following and Followers;
- the host occupies a full-width flex line;
- fallback placement remains inside the hover-card content subtree;
- pointer-down opens Edit even when the launcher is removed before click;
- pointer activation is not duplicated by its subsequent click;
- keyboard click still opens Edit;
- saved Display Name, Profession, Company, and Tags render from `AccountSummary`;
- empty metadata fields are omitted;
- unsaved and lookup-error states remain compact;
- synchronous runtime messaging throws become promise rejections;
- invalid contexts trigger WXT cleanup rather than an uncaught error.

The full unit test suite, TypeScript compilation, Chrome MV3 production build, and popup bundle verification will run before integration.

## Out of Scope

- Recreating X's hover card.
- Depending on generated X class names.
- Intercepting or extending X's hover-dismissal timers.
- Showing every Contexto field in the compact summary.
- Automatically reinjecting a content script into an X tab after the extension is reloaded.
- Changing toolbar-popup or full-profile editor behavior.

## Acceptance Criteria

- Following and Followers remain adjacent in their native order.
- Contexto appears on a separate full-width line below both counts and before mutual-followers content when X exposes the semantic count links.
- Contexto never overlaps X controls.
- Edit opens the persistent editor for pointer and keyboard activation even if X removes the hover card during the pointer sequence.
- Saved accounts show Display Name and any populated Profession, Company, and Tags; empty fields are absent.
- Unsaved accounts remain compact and editable.
- Reloading the extension while an X tab is open does not leave an uncaught `Extension context invalidated` error from Contexto messaging; stale Contexto UI cleans up.
- Existing full-profile and toolbar-popup behavior remains unchanged.

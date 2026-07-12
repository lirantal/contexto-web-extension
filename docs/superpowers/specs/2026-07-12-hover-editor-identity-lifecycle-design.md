# X Hover Editor Identity and Lifecycle Design

## Problem

The Contexto-owned hover editor now opens visibly, but two regressions make it unusable:

1. The Display name field can contain `Following` instead of the hovered account's name. The extractor currently selects the first non-handle span from X's broad `UserName` subtree, which can include action-button text before the identity content.
2. Any click inside the Shadow DOM form closes the editor. A click that crosses a Shadow DOM boundary is retargeted to the shadow host for listeners outside the shadow root. The controller compares `event.target === host`, so it mistakes every internal click for a backdrop click.

The requested lifecycle is stricter than the current behavior: only **Save** and **Cancel** may close the hover editor.

## Goal

Extract the hovered account's real display name from its matching identity link, keep the editor open during all form interaction, and close it only after a successful Save or an explicit Cancel. Preserve the inline profile-page editor's existing stay-open-after-save behavior.

## Display Name Extraction

The extractor continues to identify the account by its normalized X handle. To read the display name it will:

1. Find an exact profile link whose path is `/<handle>` and whose descendant spans include the matching `@handle`.
2. Within that identity link, find the matching handle span.
3. Select the nearest preceding nonempty span that is not handle text and is not inside a `button` or `[role="button"]` control.
4. If X does not expose that identity-link structure, apply the same nearest-to-handle rule within `[data-testid="UserName"]`.
5. Fall back to the normalized handle only when no safe name text exists.

This rejects unrelated action text such as `Following` while retaining full display names containing punctuation, emoji, or non-ASCII characters.

## Hover Editor Close Contract

The Contexto-owned hover editor must remain mounted for:

- clicks and pointer interaction anywhere inside the form;
- clicks outside the fixed panel;
- clicks on the modal backdrop;
- Escape key presses;
- field changes, tag/folder interaction, lookup retries, and failed saves.

The controller will remove its host-level click-to-close listener. Its modal keyboard handler will retain Tab focus trapping but stop handling Escape as a close action.

The header close (×) control will not render for the persistent hover editor. The user-facing close actions are only Save and Cancel.

## Save and Cancel

`ContextoProfileSurface` already receives an optional close callback only when rendered by the persistent page editor controller.

- On successful Save, after clearing the draft and updating the returned account, the surface calls the optional close callback.
- On a failed or rejected Save, it does not call the callback and keeps the form visible with its existing error/retry UI.
- On Cancel, it restores persisted values, clears the draft, and calls the optional close callback.
- The inline profile-page surface receives no close callback, so successful Save continues to update and display the form without hiding it.

The controller's existing draft guard remains defense in depth: both successful Save and Cancel clear the draft before requesting close.

## Data Flow

1. Hover extraction produces a `ProfileSnapshot` with the exact handle and display name from the matching identity link.
2. Edit opens the Contexto-owned panel/modal with that snapshot.
3. The surface lookup prepopulates persisted metadata or uses the corrected snapshot for an unsaved account.
4. Internal interaction never invokes controller close behavior.
5. Successful Save or Cancel invokes the surface close callback and removes the persistent editor host.

## Error Handling

- Missing or changed X identity markup falls back to the matching handle rather than unrelated UI text.
- Lookup and save failures retain existing visible error and retry states.
- Invalidated extension contexts retain the existing lifecycle-aware cleanup behavior; lifecycle invalidation and page navigation may still remove the editor because they are system teardown, not user dismissal.

## Testing

Automated regressions will verify:

- hover markup where `Following` precedes the actual name extracts the actual display name;
- the matching `@handle` anchors identity scoping when other profile text is present;
- full-profile extraction retains its correct name behavior;
- clicks on inputs, buttons, and Shadow DOM content do not close the editor;
- backdrop clicks do not close the modal;
- Escape does not close the modal, while Tab focus trapping remains intact;
- the header × control is absent;
- successful Save closes the persistent hover editor;
- failed Save remains open;
- Cancel clears the draft and closes;
- successful Save keeps the inline profile-page form open.

The full unit suite, TypeScript compilation, Chrome MV3 production build, and popup artifact verification will run before integration.

## Out of Scope

- Changing fixed-panel placement or responsive breakpoint.
- Changing compact hover metadata presentation.
- Adding unsaved-change confirmation.
- Changing toolbar popup behavior.
- Closing the hover editor from outside clicks, backdrop clicks, Escape, or a header control.

## Acceptance Criteria

- The Display name field shows the hovered X account's actual display name, never `Following` or other action text.
- The editor remains open and usable during all field, tag, folder, button, backdrop, and keyboard interaction except Save or Cancel.
- Successful Save closes the persistent hover editor.
- Failed Save keeps the persistent hover editor open with retry/error feedback.
- Cancel closes the persistent hover editor after discarding its draft.
- The inline profile-page form remains visible after Save.
- Existing saved metadata, panel/modal placement, and extension lifecycle cleanup continue to work.

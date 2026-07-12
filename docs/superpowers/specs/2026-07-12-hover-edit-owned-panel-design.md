# X Hover Edit Contexto-Owned Panel Design

## Problem

The Contexto hover launcher renders and loads saved metadata correctly, but selecting **Edit** produces no visible editor on X feed pages and no extension error.

The current implementation has two fragile boundaries:

1. Pointer-down activation runs only when `PointerEvent.pointerType` is exactly `mouse`, `pen`, or `touch`. If Vivaldi/React reports an empty or unexpected pointer type inside the Shadow DOM, pointer-down does nothing. X may remove the hover card before the later `click`, so the fallback click handler never runs.
2. The persistent editor is appended inside X's `[data-testid="sidebarColumn"]`. That subtree is owned and reconciled by X. X can remove, hide, or reposition the injected host without producing a Contexto runtime error.

Existing tests mask both risks: the launcher test supplies `pointerType: 'mouse'`, and the controller test uses an empty sidebar that never reconciles its children.

## Goal

Make hover-card Edit activation independent of pointer-type reporting and render the persistent editor in a Contexto-owned layer that X does not control. On wide screens the editor should appear as a fixed panel over the right/third-column area; on narrow screens it should use the existing centered modal.

## Activation

The Edit button opens the editor on every pointer-down event while enabled. It does not inspect `pointerType`. A ref records that the pointer path already activated the editor so the subsequent browser click is ignored.

The regular click handler remains for keyboard and assistive-technology activation, where no pointer-down occurs.

The handler does not wait for click, cancel X hover timers, or synthesize pointer events. This guarantees that the controller is called before X can remove the hover-card subtree.

## Contexto-Owned Editor Host

The page editor controller always mounts its host directly under the supplied root (`document.body` in the content script). It no longer queries, appends to, or observes X's sidebar column.

Because the host is a sibling of X's application root rather than a descendant of X-owned React content, X reconciliation cannot remove or reposition it. The host continues using a Shadow DOM root for style and component isolation.

## Responsive Placement

The controller uses `window.matchMedia('(min-width: 1100px)')` to select one of the existing placement modes:

- At 1100px and wider, `docked` means a Contexto-owned fixed panel positioned at the top-right of the viewport. It is 380px wide, constrained to the viewport, vertically scrollable, and layered above X's right column.
- Below 1100px, `modal` keeps the existing centered backdrop and dialog behavior.

The fixed panel does not change X's layout or reserve space. It overlays the right/third-column area, which the user explicitly accepted.

The controller listens for media-query changes while active. Crossing the breakpoint updates the placement data attribute, rerenders dialog semantics, and applies modal focus only when changing into modal mode.

## Existing Editor Behavior

The complete `ContextoProfileSurface` remains unchanged:

- the saved account lookup and prefilled fields;
- draft protection and Cancel behavior;
- saving and retry states;
- close control;
- modal Escape and focus-trap behavior;
- profile-scoped remounting.

The return-focus target remains the hover Edit button when it is still connected. If X removed the hover card, closing simply skips focus restoration.

## Error Handling

The existing lifecycle-aware content runtime sender remains responsible for invalidated extension contexts. This change introduces no new browser messaging path.

If `matchMedia` is unavailable, the controller uses modal placement, the safer visible fallback.

## Testing

Automated regression coverage will include:

- pointer-down with no `pointerType` opens the editor;
- the subsequent click does not open it twice;
- keyboard click still opens it once;
- a real launcher mounted inside a Shadow DOM calls the real controller before the hover host is removed;
- a populated X sidebar exists but never owns the editor host;
- the editor host is a direct child of `document.body` in both panel and modal modes;
- a wide viewport produces fixed-panel placement;
- a narrow viewport produces modal placement and focus behavior;
- changing the media query moves between panel and modal semantics without replacing the editor host;
- disconnect removes the media-query listener and editor host.

The full unit suite, TypeScript compilation, Chrome MV3 production build, and popup artifact verification will run before integration.

## Out of Scope

- Injecting into or reserving space within X's third column.
- Modifying X's hover timers or event handlers.
- Changing compact saved metadata presentation.
- Changing the full-profile editor or toolbar popup.
- Automatically reopening an editor after navigation or extension reload.

## Acceptance Criteria

- A physical Edit click opens the complete editor before X removes the hover card.
- Keyboard activation continues to open the editor.
- The editor host is never mounted inside X's sidebar or any other X-owned content subtree.
- On viewports at least 1100px wide, the editor is immediately visible as a fixed top-right panel over the right-column area.
- On narrower viewports, the editor is immediately visible as the existing centered modal.
- Saving, editing, cancellation, close behavior, draft protection, and responsive transitions continue to work.
- No new errors appear in the extension manager.

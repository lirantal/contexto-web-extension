# X Hover-Card In-Flow Contexto Launcher Design

## Problem

The Contexto launcher is currently mounted as an absolutely positioned overlay at the bottom-right of X's hover-card dialog. In the observed X layout, that position overlaps the **View Profile** call to action. The launcher is also appended to the outer dialog rather than X's inner profile-content stack, so moving the pointer onto the injected overlay can leave the interaction region X uses to retain the hover card.

## Goal

Render the compact Contexto status and **Edit** action as a normal in-flow row immediately after X's Following/Followers count row. The launcher must not overlap X controls, and interacting with it must remain interaction with the hover card. Clicking **Edit** continues to open the existing persistent right-rail editor or modal fallback.

## Placement Strategy

Add a focused hover-card placement resolver. It receives the discovered hover-card root and returns an insertion location within X's inner content stack.

The resolver identifies the count row using semantic profile links rather than generated X class names:

- a link whose profile-relative path ends in `/following`;
- a follower link whose profile-relative path ends in `/followers` or `/verified_followers`;
- the nearest shared row containing those links.

The Contexto mount host is inserted immediately after that row, within the same parent. This makes the launcher a real part of the card's layout and hit-tested content region.

If the count row cannot be identified, the resolver chooses a safe in-flow fallback inside the innermost profile-content container. The fallback is inserted before a bottom profile CTA when one can be identified, otherwise at the end of that content container. It never reverts to absolute positioning.

## Visual Treatment

The launcher remains compact and full-width:

```text
1,724 Following   3,149 Followers

◆ Contexto        Not saved       Edit

Followed by Shaun Smith…
[ View Profile ]
```

It uses a modest vertical margin, a subtle border, and the existing light/dark theme tokens. The row is visually distinct without imitating or covering an X control. The intentional card-height increase is acceptable and is preferred to an overlay.

## Mounting and Cleanup

`mountContextoSurface` uses the placement resolver only for hover cards. Full-profile mounting remains unchanged.

The hover mount no longer:

- changes the outer hover-card root's `position` style;
- relies on bottom/right offsets;
- assigns an overlay z-index.

Cleanup unmounts React and removes only Contexto's mount host. Because no X styles are mutated, there is no host-position restoration step.

## Hover Retention

The fix relies on correct DOM ownership instead of synthesizing mouse events or patching X timers. The Contexto host is a descendant of the same inner content container as the follower counts. Pointer and focus events therefore occur within the hover card's actual content subtree.

No private X dismissal behavior is intercepted. If X changes its internal markup, semantic placement falls back to another in-flow location rather than a floating overlay.

## Existing Editor Flow

Launcher lookup and status behavior remain unchanged:

- `Loading…` while Contexto lookup is pending;
- `Saved` or `Not saved` after a successful lookup;
- compact retry UI after a lookup error.

Selecting **Edit** passes the profile snapshot and button element to the existing page editor controller. The right-rail editor or modal remains mounted independently if X later removes the hover card.

## Testing

Automated tests will cover:

- semantic detection of standard `/following` and `/followers` links;
- support for `/verified_followers`;
- insertion immediately after the shared count row;
- insertion inside the inner content container rather than the outer dialog;
- safe in-flow fallback when count links are missing;
- absence of absolute-position, bottom-offset, and host-position mutation behavior;
- cleanup without changing X-owned inline styles;
- unchanged full-profile mounting and launcher-to-page-editor behavior.

The complete test suite, TypeScript compilation, production build, and popup artifact verification will run after implementation.

## Out of Scope

- Recreating X's hover card.
- Modifying X's hover-dismissal timers or dispatching synthetic hover events.
- Changing the persistent right-rail/modal editor.
- Changing toolbar popup or full-profile editor behavior.

## Acceptance Criteria

- The Contexto row appears immediately below Following/Followers when those links are present.
- The row does not cover **View Profile** or any other X control.
- Moving the pointer from X content onto Contexto does not dismiss the hover card.
- **Edit** remains clickable and opens the persistent editor.
- Missing or changed count-row markup still produces a non-overlapping in-flow launcher.
- Removing the hover card cleans up the Contexto root without leaving style mutations behind.

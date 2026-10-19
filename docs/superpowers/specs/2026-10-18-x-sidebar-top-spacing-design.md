# X Sidebar Embedded Workspace Top Spacing

## Problem

In Vivaldi, the top of the Contexto workspace embedded in X's right sidebar can appear clipped against the top of the page. The embedded workspace host currently has 12px of top margin.

## Design

Increase only the top margin of the Contexto X sidebar host from 12px to 24px, keeping the existing 16px bottom margin. This adds the requested 2× vertical separation around the website-embedded workspace while leaving the toolbar popup and other Contexto surfaces unchanged.

The change belongs on the sidebar host selector in `src/ui/contexto-profile-surface.css`. The host-level margin keeps the account search and Quick X search sections aligned as one workspace and does not alter X-owned DOM or the sidebar mount contract.

## Alternatives considered

- Add spacing inside only the Quick X search section: rejected because the account search would remain against the top edge and the shared workspace would have uneven spacing.
- Add padding to the workspace container: rejected because it changes the bordered workspace interior rather than creating separation from the surrounding X layout.

## Verification

Add a CSS contract assertion that the X sidebar host uses `margin:24px 0 16px;`. Run the focused layout test, the full Vitest suite, compile, build, and popup verification. The existing browser workflow remains the manual follow-up for confirming the visual result in Vivaldi.

## Documentation impact

No current behavior or architecture documentation needs to change; this is a localized visual spacing adjustment covered by the existing browser QA matrix.

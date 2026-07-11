# Compact Toolbar Popup Design

## Goal

Make the Contexto toolbar popup show its complete quick-search form, all four
search actions, and footer controls without scrolling at 100% browser zoom on a
normal desktop display, while making the content feel less crowded against the
browser's right-side UI.

## Browser constraints

Chrome-compatible action popups are automatically anchored and positioned by
the browser. Extension HTML and CSS cannot add a reliable external offset
between the popup window and the edge of the browser toolbar or side panel.
Action popups are also capped at 600 pixels high.

The implementation will therefore keep the native toolbar popup, fit its normal
content below the height cap, and create visual breathing room with an internal
right gutter. Replacing the action popup with a separately positioned browser
window is out of scope.

## Layout design

The existing single-column form and four full-width search actions remain. The
popup will be compacted without removing fields, helper text, query previews,
or footer actions:

- Use border-box sizing so the declared popup width includes its padding.
- Reduce vertical shell padding, header spacing, section gaps, input padding,
  action-button height, and footer spacing.
- Give the content a slightly larger right inset than it has today so controls
  and text do not visually touch the browser's right-side chrome.
- Keep query previews on one line and truncate overflow with an ellipsis. The
  existing button `title` continues to expose the full query on hover.
- Complete the unfinished `.search-action small` rule in the current stylesheet.

The target is a rendered document height below 590 pixels at 100% zoom, leaving
a small allowance under Chrome's 600-pixel popup maximum.

## Overflow behavior

The normal desktop layout should not need a scrollbar. Vertical scrolling will
remain available as a fallback when the available screen height is smaller or
the user increases browser or operating-system text scaling. Content must never
be clipped merely to satisfy the nominal height target.

## Accessibility and behavior

This is a presentation-only change. Input labels, focus order, button labels,
disabled states, persistence, generated queries, and navigation behavior remain
unchanged. Truncated query previews retain their full accessible button content
and their full hover title.

## Verification

- Add a lightweight layout-contract test for the popup's compact CSS rules,
  including border-box sizing, one-line preview overflow, and fallback scrolling.
- Run the existing Vitest suite and TypeScript compile check.
- Build the Chrome extension.
- Manually inspect the unpacked popup in Chrome or Vivaldi at 100% zoom and
  confirm that the header, every field, all four actions, and the footer are
  visible without scrolling.
- Increase zoom or reduce the available window height and confirm that fallback
  scrolling preserves access to every control.
- Confirm that the larger internal right gutter improves separation from the
  browser's side UI, noting that the native popup window itself remains anchored
  by the browser.

## Out of scope

- A detached or programmatically positioned popup window.
- Moving the browser toolbar icon or side panel.
- Removing search guidance or query previews.
- Redesigning the search form or changing search behavior.

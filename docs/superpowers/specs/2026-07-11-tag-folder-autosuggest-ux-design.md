# Tag and Folder Autosuggest UX Design

## Goal

Improve the shared Tags and Folders multi-value field so existing values are easy to distinguish and select with either the keyboard or pointer, while preserving quick creation of new values.

## Scope

This change applies only to the custom `MultiValueField` used for Tags and Folders in the inline X profile editor. It does not change the native Company datalist, the dashboard's plain tag and folder inputs, or the popup target-handle combobox.

## Interaction Design

Typing a non-empty query opens a listbox containing matching existing values that are not already selected. Matching remains case-insensitive and substring-based.

Users can press Arrow Down or Arrow Up to move an active highlight through the matches. Navigation wraps at the beginning and end of the list. Pressing Enter selects the active existing value. When no existing value is active, Enter creates the trimmed query as a new value, preserving the current inline-creation behavior. Pressing Escape closes the listbox and clears the active highlight without clearing the query.

Clicking an existing suggestion selects it. Pointer movement over a suggestion updates the same active highlight used by keyboard navigation so the visual and accessible states agree.

The listbox contains only existing matching values. It does not render a separate “Create” row. A typed value can still be created by pressing Enter when no suggestion is active.

Changing the query resets the active highlight. Adding a value clears the query, closes the listbox, and clears the highlight. Disabled fields expose no interactive suggestions.

## Visual Design

Existing suggestion text uses a light blue link-like color so suggestions read as selectable existing values. The active or hovered suggestion has a blue-tinted background and a stronger blue text color. The list retains the existing compact border and rounded corners and works with the component's light and dark theme variables.

## Accessibility

The text input is an ARIA combobox with `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, and `aria-activedescendant` while an option is active. The suggestions container is a listbox with a stable generated id. Every suggestion is an option with a stable id and `aria-selected` reflecting the active highlight.

Keyboard handling prevents the browser or surrounding X page from consuming Arrow Up, Arrow Down, Enter, or Escape only when the autosuggest handles that key. Mouse-down selection preserves input focus long enough for the click to complete.

## Testing

Focused component tests will verify:

- Matching suggestions appear without a “Create” row.
- Arrow Down and Arrow Up wrap and update the active descendant.
- Enter selects the active suggestion.
- Enter creates a typed value when no suggestion is active.
- Escape closes the listbox without clearing the query.
- Pointer selection still adds an existing value.
- Tags and Folders both use the shared behavior through the profile editor.

The full unit test suite, TypeScript compilation, and production extension build will be run before completion.

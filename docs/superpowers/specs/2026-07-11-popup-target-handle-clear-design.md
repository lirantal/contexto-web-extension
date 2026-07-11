# Popup target-handle clear control design

## Scope

Add a compact clear control to the **Other person's X handle** field in the browser toolbar popup. No other popup fields or search behavior change.

## User interaction

- When the target-handle field contains one or more characters, show an inline `X` icon button at the input's right edge.
- When the field is empty, do not render the button.
- Activating the button clears the field and persists the empty `targetHandle` through the existing popup search-state updater, exactly as if the user had deleted its contents manually.
- The button has the accessible name `Clear other person's X handle` and uses a standard button so it works with mouse, keyboard, and assistive technology.

## Component and styling

The existing controlled input remains the source of truth. A small wrapper provides the positioning context for the button. Extra right padding on the input prevents the typed handle from sitting beneath the control. The button uses the project's existing Lucide icon system and is visually unobtrusive while retaining a clear hover and keyboard-focus state.

## Error handling

Clearing is a normal state update. It neither changes validation rules nor triggers a search. If persistence is unavailable, behavior remains aligned with the existing fire-and-forget popup search-state save path.

## Tests

Add a popup component test that verifies the clear button is present for a restored target handle, clears the controlled input when activated, and asks the existing search-state persistence layer to save an empty target handle while retaining the other search fields. The existing test suite continues to cover form restoration and other optional-field changes.

# Feed Context Marker Click Isolation Design

## Problem

The Contexto marker mounted in an X feed post opens the compact relationship panel, but the same click continues through X's clickable post container. On the main feed, X consequently navigates to the post detail page. The problem is not visible on an already-open post detail page because that surface does not apply the same feed navigation behavior.

The existing component tests render the marker without a clickable X feed ancestor, so they verify panel toggling but do not protect the event-boundary behavior.

## Desired behavior

- Clicking the Contexto marker in a feed post opens or closes the compact relationship panel without navigating away from the feed.
- The marker remains a semantic button with its existing accessible expanded state.
- Intentional navigation inside the panel remains unchanged. In particular, **Catch up on X** and **View our interactions** continue opening their current X destinations.
- All other compact-panel actions retain their current behavior.

## Design

Keep the marker in the validated author header. Change only its click handler: cancel the click's default action and stop its propagation before toggling the panel state. This prevents both an enclosing link default and X's delegated feed-post click handler from interpreting the marker activation as post navigation.

Do not add an event boundary around the complete Contexto widget. A broad boundary could interfere with the panel's intentional links and is unnecessary for the reported failure.

## Testing

Add a regression test around the real feed component. Render it inside a clickable feed-post ancestor, activate the marker, and assert both outcomes:

1. The compact relationship panel opens.
2. The surrounding post click/navigation handler is not invoked.

The test must fail against the current handler before the implementation changes. Existing tests continue to cover panel links and other actions; focused and full project verification will confirm that their behavior is preserved.

## Documentation

Update the canonical saved-contact feed context documentation and browser QA matrix to state that marker activation stays on the feed and does not trigger the enclosing post navigation.

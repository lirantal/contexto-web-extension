# Testing

## Automated checks

Run the following before handing off a release build:

```sh
npm run compile
npm test
npm run build
npm run verify:popup
```

Use focused Vitest commands while iterating, then run the complete suite before completion.

## X DOM fixtures

Store observed X markup variants under `tests/fixtures/x/`. Fixtures are minimal structural examples named for the DOM variant rather than a real account. Do not treat a live X selector or DOM hierarchy as a stable API.

Every fixture must have an assertion that identifies the protected behavior. Include negative assertions where they matter, such as proving that action labels do not become display names or that unrelated page handles are ignored.

Post-bookmark fixtures must prove that the validated primary-author status URL and top-level post text are selected while quoted-post links/text, mismatched handles, ambiguous status links, and promoted posts fail closed.

## Interaction lifecycle tests

Use controller tests with composed Shadow DOM events for mounting, focus, and dismissal behavior. Explicitly assert interactions that must not close the editor, including internal clicks, backdrop clicks, and Escape.

Use surface tests for successful Save, failed Save, Cancel, draft retention, and the inline-versus-modal lifecycle distinction. A failed Save must leave the owned editor and draft available; the full-profile inline editor must remain visible after Save or Cancel.

Bookmark component tests cover duplicate lookup, optional-reminder capture, pending controls, success, retry-preserved drafts, Cancel/panel-close clearing, dashboard loading/removal errors, safe source links, empty collections, and stale account requests. Repository tests cover ownership and URL validation, field bounds, deduplication, soft deletion/restoration, recency ordering, change logging, and backup format 1/2 compatibility.

## Manual browser checks

Synthetic tests cannot reproduce every X or browser lifecycle. Run the matrix in [Browser Development Workflow](development/browser-workflow.md) after changing content-script mounting, X selectors, popup layout, Shadow DOM behavior, or extension lifecycle handling.

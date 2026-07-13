# Prior-interaction shortcut design

## Summary

Add a lightweight **View our interactions** shortcut to the existing saved-contact feed panel on X. The shortcut opens X's live search results for public posts sent in either direction between the Contexto user's configured X handle and the saved post author.

This slice adds navigation only. It does not add a new application surface, persist interaction data, record search history, or infer the signed-in X account from X's DOM.

## User experience

The existing saved-contact feed panel includes a link-style **View our interactions** action when all of the following are true:

- the primary post author resolves to a saved Contexto account;
- Contexto settings load successfully; and
- `myXHandle` and the saved author's handle are both valid X handles.

The shortcut opens a new tab with X's live search results for the combined query:

```text
(from:viewer to:author) OR (from:author to:viewer)
```

Opening the search leaves the Contexto feed panel open. It does not affect bookmark capture or the existing **Open full context** action.

If the viewer handle is missing or invalid, or settings cannot be loaded, the shortcut is omitted. This first slice does not render a disabled state, setup prompt, or settings-navigation affordance.

## Architecture

`src/shared/platforms/x.ts` gains a focused helper that accepts a viewer handle and target handle, validates and normalizes both, and returns the combined live-search URL or no URL when either handle is invalid. The shared adapter remains the only owner of X query and URL construction.

`ContextoFeedContext` loads the saved-account lookup and current Contexto settings independently. Account lookup retains its existing fail-closed behavior: an unknown account or failed lookup renders no Contexto feed surface. A settings failure affects only the interaction shortcut; saved relationship context and bookmark lookup/capture continue to work.

When the helper returns a URL, the component renders a normal external anchor with `target="_blank"` and `rel="noopener noreferrer"`. No background navigation message, database schema change, or repository operation is required.

## Data flow

1. The feed surface supplies the validated primary-author profile to `ContextoFeedContext` as it does today.
2. The component requests the saved account and Contexto settings through the existing typed message boundary.
3. Bookmark lookup continues after a saved account is found and an eligible post snapshot exists.
4. Valid viewer and author handles produce the two-way interaction-search URL.
5. Selecting the shortcut asks the browser to open that X URL in a new tab through ordinary anchor navigation.

No search-history record is written in this slice.

## Resilience and security

- Both handles are validated and normalized before they enter the query.
- Invalid or missing handles cannot produce a link.
- A settings lookup rejection or unsuccessful response hides only the shortcut.
- The link uses safe new-tab attributes.
- X search operator behavior is an external, versionless dependency. Automated tests protect Contexto's query construction, while the browser QA matrix verifies X still accepts the generated query.

## Testing

Adapter tests cover:

- the exact normalized two-way query;
- the live-search URL and encoded query;
- leading `@` and mixed-case handle normalization; and
- omission for either invalid handle.

Feed-context component tests cover:

- visibility when valid settings and a saved author are available;
- the exact destination and safe new-tab attributes;
- omission for missing, invalid, failed, or rejected settings lookups; and
- continued saved-contact and bookmark behavior when settings are unavailable.

Canonical feature documentation and the browser QA matrix describe the shortcut and its dependency on the configured viewer handle.

## Out of scope

- Local interaction indexing or scoring.
- Private-DM access or scraping.
- Search-history persistence for the shortcut.
- Keyword, date, or direction controls in the feed panel.
- Inferring the current X identity from page DOM.
- A setup prompt or settings deep link when `myXHandle` is absent.

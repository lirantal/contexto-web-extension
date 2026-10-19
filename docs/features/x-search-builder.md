# Feature: X Search Builder

Contexto builds X search URLs without using unofficial X APIs.

The toolbar popup organizes the workflow into three visible groups:

- **People** contains your X handle and the optional other person's handle.
- **Filters** contains the optional keyword, since date, and until date.
- **Choose what to search** contains the four search actions and their query previews.

This grouping changes only the presentation; search enablement, query construction, history, and tab navigation remain unchanged.

Supported directions:

- `Messages I sent`: `from:{me} to:{them}`.
- `Messages to me`: `from:{them} to:{me}`.
- `Posts from profile`: `from:{them}`.
- `Posts to profile`: `to:{them}`.
- `Mentions`: `@{them}`.

Optional filters:

- Keyword.
- Since date.
- Until date.

Generated searches open in X and are recorded in local search history.

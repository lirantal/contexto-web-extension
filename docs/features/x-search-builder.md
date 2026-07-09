# Feature: X Search Builder

Contexto builds X search URLs without using unofficial X APIs.

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

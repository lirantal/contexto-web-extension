# Feature: X Search Builder

Contexto builds X search URLs without using unofficial X APIs. The complete Quick X search builder is available in both the toolbar popup and an always-expanded Contexto section of X's right sidebar.

Both surfaces are the same persisted workflow. They share the viewer and target handles, keyword, dates, saved-account suggestions, free-form target entry, target autosuggest history, validation, and successful new-tab launch behavior. A search is enabled only when its required normalized handle is present; validation failures do not launch a tab. After a successful launch, the normalized target is added to autosuggest history; a failed launch does not add history.

On X, the builder is hosted in Contexto-owned Shadow DOM immediately before X's validated native search form. Contexto mounts only when it can prove that the native search input is inside that form. If that evidence is missing, Contexto fails closed: it does not mount or alter X's native search. X's native search and the separately configured native-sidebar-widget policy remain independent and usable.

Supported directions:

- `Posts by me`: `from:{me} to:{them}`.
- `Posts to me`: `from:{them} to:{me}`.
- `Posts by other person`: `from:{them}`.
- `Mentions of other person`: `@{them}`.

Optional filters:

- Keyword.
- Since date.
- Until date.

Generated searches open in a new X tab. After a successful launch, the normalized target is recorded only in extension-local autosuggest history.

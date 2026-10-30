# Feature: X Search Builder

Contexto builds X search URLs without using unofficial X APIs. The complete Quick X search builder is available in both the toolbar popup and an always-expanded Contexto section of X's right sidebar.

Both surfaces are the same persisted workflow. They share the viewer and target handles, keyword, dates, saved-account suggestions, free-form target entry, target autosuggest history, validation, and successful new-tab launch behavior. A search is enabled only when its required normalized handle is present; validation failures do not launch a tab. After a successful launch, the normalized target is added to autosuggest history; a failed launch does not add history.

The embedded sidebar prefills **Other person's X handle** from the current profile URL or canonical conversation URL (`/<handle>/status/<id>`). It applies the normalized handle after saved search state loads and when navigation changes the viewed handle, without remounting the workspace. You can edit or clear the prefilled value on that view. Unsupported routes such as Home and Search retain the existing target. Prefilling persists only the target field through the shared search-state workflow; it does not launch a search or add autosuggest history. The popup continues to restore shared saved state without deriving a target from the active tab.

Editing updates the active form immediately and persists only the changed field through the background service worker. A launch waits for outstanding field patches, while target-history promotion remains a separate best-effort operation after the tab opens successfully.

On X, the builder is hosted in a Contexto-owned closed Shadow DOM root directly inside the validated sidebar column, above the native branch containing X's search form. It stays outside X's constrained search shell and sticky wrappers so they cannot clip its top. The workspace reserves 72 pixels at the top for X's pinned native search header plus a 12-pixel gap. It stays sticky at that 72-pixel offset while the page scrolls, including profile and conversation views, and provides its own scroll area capped at the viewport height minus that top space and a 12-pixel bottom gap. Its styles, both workspace sections, and launch controls stay inside that root and are not exposed through page-level selectors. Contexto mounts only when it can prove that the native search input is inside a form in the sidebar column. If that evidence is missing, Contexto fails closed: it does not mount or alter X's native search. X's native search and the separately configured native-sidebar-widget policy remain independent and usable.

The toolbar popup organizes the workflow into three visible groups:

- **People** contains your X handle and the optional other person's handle.
- **Filters** contains the optional keyword, since date, and until date.
- **Choose what to search** contains the four search actions and their query previews.

This grouping changes only the presentation; search enablement, query construction, history, and tab navigation remain unchanged.

Supported directions:

- `Posts by me`: `from:{me} to:{them}` when a target is present, or `from:{me}` without a target.
- `Posts to me`: `from:{them} to:{me}` when a target is present, or `to:{me}` without a target.
- `Posts by other person`: `from:{them}`.
- `Mentions of other person`: `@{them}`.

Optional filters:

- Keyword.
- Since date.
- Until date.

Both surfaces offer **Last 30 days**, **Last 90 days**, and **Last 12 months** shortcuts below the dates. A shortcut sets Until to today in the browser’s local calendar and Since to 30 days, 90 days, or one calendar year earlier (February 29 clamps to February 28). X treats Until as an exclusive upper bound. Both dates update together in one persisted patch, preserving people and keyword filters; they remain manually editable. Shortcuts do not launch a search or add target history.

Generated searches open in a new X tab. After a successful launch, the normalized target is recorded only in extension-local autosuggest history.

Keyboard events from the sidebar workspace stop at its Contexto host after its controls handle them. This prevents X shortcuts from interpreting typing in account search, handles, keyword, and date fields, while preserving native editing, Tab navigation, and Contexto autocomplete controls. Native X controls retain their keyboard behavior.

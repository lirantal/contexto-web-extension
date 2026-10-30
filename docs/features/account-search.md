# Feature: Account Search

The dashboard account list searches across account context, not only handles.

On X, Contexto also provides a local saved-account search directly above X's native right-sidebar search. It has top and bottom spacing so neither search surface is clipped or overlaps the following rail content. The Contexto field fuzzy-matches only saved X display names and handles, shows up to five results, and opens a selected profile in the current tab. Each result presents the display name first, then the visible `@handle` with available role and company context, and the whole row remains keyboard-focusable and navigable. It never changes or searches X's native field.

Native X right-rail widgets after the search area are hidden by default. The dashboard's **Show X sidebar widgets** setting restores them live, in their original order, with the first widget beginning around the middle of the viewport.

Search currently matches:

- Handle.
- Display name.
- Company.
- Role.
- Location.
- Relationship source.
- Latest note text.
- Tag names.
- Circle names.

Dashboard filters support multiple circles, tags, and companies. Expand a filter to search saved options and select them with checkboxes; selected values remain visible as removable chips when collapsed. Search text and every selected item combine with **AND**, including items within the same category. For example, three tags and two circles return only accounts assigned all three tags and both circles. An empty category adds no restriction. **Clear filters** resets the query and all selections.

Accounts currently have one company. Selecting different companies therefore returns no accounts under the AND rule; the dashboard explains this when multiple companies are selected.

## Account deletion

The dashboard account details pane includes **Delete account**. After explicit confirmation, Contexto permanently removes that account's profile metadata, notes, bookmarks, search history, tag/circle assignments, and related local change-log entries in one transaction. Shared company, tag, and circle definitions remain available to other accounts. The action has no in-app undo; export a backup first if the account may need to be recovered.

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
- Folder names.

Dashboard filters also support narrowing by folder, tag, and company.

## Account deletion

The dashboard account details pane includes **Delete account**. After explicit confirmation, Contexto permanently removes that account's profile metadata, notes, bookmarks, search history, tag/folder assignments, and related local change-log entries in one transaction. Shared company, tag, and folder definitions remain available to other accounts. The action has no in-app undo; export a backup first if the account may need to be recovered.

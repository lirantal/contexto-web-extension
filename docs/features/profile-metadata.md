# Feature: Profile Metadata

Contexto integrates directly into X user hover cards and full profile pages. Hover cards show a compact Contexto status and **Edit** launcher without changing the card into a large form. **Edit** opens the complete editor in X's right rail, with a Contexto-owned modal fallback when the rail is unavailable. Full profile pages show the same complete editor inline, with a 16-pixel top margin separating it from X's native profile metadata and follower/following counts. The editor prefills the display name, handle, profile URL, avatar URL, bio snapshot, website, and visible location when available. Opening or editing the form does not write anything; persistence starts only when **Save to Contexto** is selected.

The complete editor groups fields by purpose in quiet, bordered cards: **Identity** contains display name, X handle, location, and website, **Work** contains role and company, and **Relationship** contains how you know the person, tags, and circles. Inline editors always stack paired fields in one column. Contexto-owned docked and modal editors use two columns only when the editor container is at least 380 pixels wide; at 379 pixels or less they stack. The hover card remains a compact saved-state summary plus the **Edit** launcher rather than embedding these groups.

All Contexto-owned surfaces use the dashboard's neutral green visual language so they remain recognizable against X: a warm tinted surface, white field and button surfaces, teal actions and selection states, amber circle chips, and a shared 7-pixel control/chip radius. Profile editors and hover summaries retain a larger 12-pixel container radius. Autocomplete options use the same high-contrast neutral and teal states instead of X's native blue.

You can enrich an account with:

- Role.
- Company.
- Location.
- Website.
- How you know each other.
- Notes.
- Tags.
- Circles.

Role, Company, and Location remain free-text fields in both the X editor and dashboard. As you type, Contexto fuzzy-matches distinct values already saved on active accounts so you can reuse a canonical spelling; you can still save a new role, company, or location when no suggestion applies.

Role, Company, and Location suggestions use one shared neutral and teal style on the dashboard and in X editors. Suggestions appear as an overlay directly below the active input, so opening the list does not resize a paired field row.

Tags and circles are separate multi-value fields with the same interaction model: search existing values, select multiple values, create a new value inline, and remove selections.

The right-rail or modal editor is owned by Contexto, so it stays mounted when X dismisses the originating hover card. Internal clicks, backdrop clicks, Escape, and pointer movement do not close it. A successful **Save** or explicit **Cancel** closes this owned editor; a failed Save keeps it open with the draft intact. Navigation, extension reload, and content-script teardown remain system lifecycle events rather than user close actions.

When an editor opens for a saved account, empty or whitespace-only Location and Website values prefill independently from the visible X profile metadata when available. Non-empty saved values and existing unsaved drafts take precedence. Prefilling does not persist anything until Save; users can edit or clear either prefilled value.

The full-profile editor is inline and remains visible after Save or Cancel. Save repopulates it from the authoritative account, while Cancel restores persisted values. Unsaved drafts remain memory-only.

Website capture reads the scoped profile’s `a[data-testid="UserUrl"]`, excluding posts and bio-text links. Direct HTTP(S) destinations are retained. For X’s `t.co` links, a complete HTTP(S) title or visible website address is preferred (bare domains receive `https://`); truncated labels retain the shortened destination without guessing. Capture does not follow redirects. Website is editable in Identity and in the dashboard, and is persisted only on Save. Missing website metadata preserves an existing value.

The dashboard exposes the same metadata in a larger offline editing view. Its **Manage data** page can rename, merge, or permanently delete companies, tags, and circles, and replace or clear roles and locations across matching contacts. Older X and dashboard metadata drafts are rejected after these changes and retain their unsaved fields; **Reload saved values** explicitly discards the draft and loads saved metadata without prefilling from an older X snapshot. Ordinary editor opening retains the profile-prefill behavior above. See [Manage data](data-management.md).

## Read-only metadata labels

Compact read-only summaries use visible labels for every saved metadata value they display. The canonical labels are **Role**, **Company**, **How you know them**, **Tags**, **Circles**, and **Latest note**. Empty fields omit both label and value. Display names, X handles, saved state, timestamps, and action/status text retain their existing identity or status presentation.

This convention applies to the X feed panel, X hover summary, dashboard read-only account metadata, and toolbar-popup account suggestions. It does not cause a surface to display metadata that the surface previously omitted.

## Contact record details (dashboard only)

The dashboard displays read-only **Added to Contexto** and **Last updated in Contexto** dates with local date/time formatting, plus **X user ID** when supplied. These use the existing contact timestamps, not the X account's join date. Invalid legacy dates display Unknown. These details are absent from embedded X forms.

The optional numeric X user ID is stored as a string. Current DOM capture has no reliable, identity-scoped ID evidence, so ordinary profile saves leave it unset and preserve any previously imported ID. Contexto does not infer user IDs from avatar URLs or Post IDs or make extra API requests to obtain them. Future API imports can supply the ID through a profile snapshot; see [Data model](../architecture/data-model.md#x-identity-and-contact-dates).

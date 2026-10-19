# Feature: Profile Metadata

Contexto integrates directly into X user hover cards and full profile pages. Hover cards show a compact Contexto status and **Edit** launcher without changing the card into a large form. **Edit** opens the complete editor in X's right rail, with a Contexto-owned modal fallback when the rail is unavailable. Full profile pages show the same complete editor inline. The editor prefills the display name, handle, profile URL, avatar URL, bio snapshot, and visible location when available. Opening or editing the form does not write anything; persistence starts only when **Save to Contexto** is selected.

The complete editor groups fields by purpose: **Identity** contains display name and X handle, **Work** contains role and company, and **Relationship** contains location, how you know the person, tags, and folders. Inline editors always stack paired fields in one column. Contexto-owned docked and modal editors use two columns only when the editor container is at least 380 pixels wide; at 379 pixels or less they stack. The hover card remains a compact saved-state summary plus the **Edit** launcher rather than embedding these groups.

You can enrich an account with:

- Role.
- Company.
- Location.
- How you know each other.
- Notes.
- Tags.
- Folders.

Company and Location remain free-text fields in both the X editor and dashboard. As you type, Contexto fuzzy-matches distinct values already saved on active accounts so you can reuse a canonical spelling; you can still save a new company or location when no suggestion applies.

Tags and folders are separate multi-value fields with the same interaction model: search existing values, select multiple values, create a new value inline, and remove selections.

The right-rail or modal editor is owned by Contexto, so it stays mounted when X dismisses the originating hover card. Internal clicks, backdrop clicks, Escape, and pointer movement do not close it. A successful **Save** or explicit **Cancel** closes this owned editor; a failed Save keeps it open with the draft intact. Navigation, extension reload, and content-script teardown remain system lifecycle events rather than user close actions.

The full-profile editor is inline and remains visible after Save or Cancel. Save repopulates it from the authoritative account, while Cancel restores persisted values. Unsaved drafts remain memory-only.

The dashboard exposes the same metadata in a larger offline editing view.

## Read-only metadata labels

Compact read-only summaries use visible labels for every saved metadata value they display. The canonical labels are **Role**, **Company**, **How you know them**, **Tags**, **Folders**, and **Latest note**. Empty fields omit both label and value. Display names, X handles, saved state, timestamps, and action/status text retain their existing identity or status presentation.

This convention applies to the X feed panel, X hover summary, dashboard read-only account metadata, and toolbar-popup account suggestions. It does not cause a surface to display metadata that the surface previously omitted.

# Feature: Profile Metadata

Contexto integrates directly into X user hover cards and full profile pages. Hover cards show a compact Contexto status and **Edit** launcher without changing the card into a large form. **Edit** opens the complete editor in X's right rail, with a Contexto-owned modal fallback when the rail is unavailable. Full profile pages show the same complete editor inline. The editor prefills the display name, handle, profile URL, avatar URL, bio snapshot, and visible location when available. Opening or editing the form does not write anything; persistence starts only when **Save to Contexto** is selected.

You can enrich an account with:

- Profession.
- Position.
- Company.
- Location.
- How you know each other.
- Notes.
- Tags.
- Folders.

Tags and folders are separate multi-value fields with the same interaction model: search existing values, select multiple values, create a new value inline, and remove selections.

The right-rail or modal editor is owned by Contexto, so it stays mounted when X dismisses the originating hover card. Internal clicks, backdrop clicks, Escape, and pointer movement do not close it. A successful **Save** or explicit **Cancel** closes this owned editor; a failed Save keeps it open with the draft intact. Navigation, extension reload, and content-script teardown remain system lifecycle events rather than user close actions.

The full-profile editor is inline and remains visible after Save or Cancel. Save repopulates it from the authoritative account, while Cancel restores persisted values. Unsaved drafts remain memory-only.

The dashboard exposes the same metadata in a larger offline editing view.

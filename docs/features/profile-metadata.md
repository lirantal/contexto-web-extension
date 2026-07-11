# Feature: Profile Metadata

Contexto integrates directly into X user hover cards and full profile pages. For accounts that are not yet saved, the complete editor appears inline and prefills the display name, handle, profile URL, avatar URL, bio snapshot, and visible location when available. Opening or editing the form does not write anything; persistence starts only when **Save to Contexto** is selected.

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

After saving, the inline surface collapses to a priority summary containing the saved display name, position and company, and tags. **Edit** restores the complete form without opening another window. Unsaved hover-card drafts are kept in memory so a transient X remount does not immediately discard active edits.

The dashboard exposes the same metadata in a larger offline editing view.

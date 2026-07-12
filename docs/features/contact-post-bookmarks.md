# Feature: Contact Post Bookmarks

Contexto bookmarks are rich, account-scoped references to X posts. They preserve the source post, a short captured excerpt, an optional personal reminder, and when the user captured it. Bookmarks remain separate from relationship notes so saved source material does not become mixed with contact history.

## Capture on X

Capture is available only from a supported post whose primary author is already saved in Contexto. The saved-contact feed panel performs a local duplicate lookup before showing **Capture this post**. Selecting it opens an inline composer labeled **Why are you saving this? (optional)**.

An empty reminder is valid. During Save, composer controls are disabled. Success collapses the composer, announces **Bookmark saved**, and changes the action to disabled **Bookmarked**. Failure preserves the reminder and allows retry. Cancel or closing the relationship panel discards an unsaved reminder.

Contexto never creates an unknown contact from capture. The background validates the saved X account and requires the canonical post URL's handle to match that account.

## Captured data

Each bookmark stores:

- Owning account ID.
- Platform and numeric X post ID.
- Canonical `https://x.com/<handle>/status/<id>` URL.
- Optional top-level post-text excerpt, bounded to 280 Unicode code points.
- Optional personal reminder, bounded to 500 Unicode code points.
- Capture, creation, update, and optional soft-delete timestamps.

Quoted-post text/links, media, engagement counts, reply targets, and external previews are not captured. Active duplicates are unique per account and canonical post URL. Recapturing a removed bookmark restores its record and refreshes the capture timestamp.

## Dashboard collection

The dashboard's selected-contact detail lists active bookmarks newest first. Each card shows available reminder and excerpt text, capture date, a safe **Open on X** link, and **Remove**. Sparse bookmarks remain useful through their date and source link. Removal is immediate and soft-deletes the local record; a failed removal keeps the item visible.

Reminder editing, non-X bookmarks, bookmark organization/search, and capture for unknown contacts are outside the current slice.

## Backup

Backup format version 2 includes bookmarks. Legacy version 1 backups still import with an empty bookmark collection. Version 2 import validates bookmark ownership, author/URL agreement, post ID, timestamps, and text bounds before writing the transaction.

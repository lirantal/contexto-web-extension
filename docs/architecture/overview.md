# Architecture Overview

Contexto is a WXT React extension with four user-facing surfaces:

- `entrypoints/content.ts`: content script for `x.com` and `twitter.com`. It observes hover cards, profiles, and feed posts and injects Shadow DOM Contexto surfaces and sends messages to the background service worker.
- `entrypoints/background.ts`: message/API boundary for content scripts. It owns profile upsert, metadata updates, explicit catch-up checkpoints, notes, contact-post bookmarks, tags, folders, settings, and search-history writes.
- `entrypoints/popup`: compact Quick X search UI for creating X search URLs.
- `entrypoints/options`: full dashboard for account search, metadata editing, filtering, backup, and restore.

The extension keeps domain logic in `src/`:

- `src/shared`: shared types, settings, message contracts, and platform adapters.
- `src/data`: Dexie database schema and repository functions.
- `src/ui`: React components shared by extension pages and content-script UI.

Feed post capture keeps stable and transient concerns separate: the shared X adapter canonicalizes supported status URLs, the X DOM boundary extracts only a validated primary post snapshot, the content UI sends typed bookmark requests, and the background persists through bookmark repositories. Dashboard bookmark review runs in the extension origin and reads the same repositories directly.

Quick X search is one shared, persisted workflow on two surfaces: the toolbar popup and an always-expanded section of Contexto's X right-sidebar workspace. Both instances share the viewer and target handles, keyword, date filters, saved-account suggestions, free-form target entry, target autosuggest history, validation, and validated new-tab launch behavior. The X content script mounts that workspace in a Contexto-owned Shadow DOM host immediately before X's validated native search form; the native X form and any separately governed native sidebar widgets stay X-owned.

## Design Principles

- Keep X-specific behavior behind an adapter so LinkedIn/Reddit can become peers later.
- Keep content scripts thin. They observe the host page and call the background service worker rather than writing CRM data directly.
- Keep local data exportable. IndexedDB is durable for an installed extension profile, but JSON backup is the recovery path if the extension/profile is removed.
- Prefer browser-native capabilities and WXT conventions over custom extension plumbing.

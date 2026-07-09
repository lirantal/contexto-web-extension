# Contexto

Contexto is a local-first browser extension for lightweight CRM and social relationship management on X/Twitter. It is built for Developer Relations and Developer Advocacy workflows where the useful context lives around people: how you met, what they work on, what company they are attached to, notes, tags, folders, and fast ways to search previous public X interactions.

The extension is built with [WXT](https://wxt.dev/), React, TypeScript, and IndexedDB through Dexie. Chrome and Vivaldi are the MVP browser targets.

## Current MVP

- X/Twitter profile-page overlay for capturing and editing relationship metadata.
- Local IndexedDB database for accounts, companies, tags, folders, notes, search history, and backups.
- Dashboard/options page for offline account search, metadata editing, filtering, import, and export.
- Popup quick-search builder for X searches with keyword and date filters.
- X search helpers for messages/posts from you to them, them to you, profile posts, direct mentions, and keyword/date constraints.
- JSON backup/restore so local data can be moved or recovered.
- Platform adapter boundary so LinkedIn and Reddit can be added later without rewriting the CRM core.

## Setup

```sh
npm install
```

The WXT scaffold generates extension types during `postinstall`.

## Development

```sh
npm run dev
npm run dev:chrome
npm run dev:vivaldi
```

All three scripts currently target Chromium MV3 through WXT. To make `npm run dev:vivaldi` open Vivaldi, create a local ignored `web-ext.config.ts` using the example in [docs/development/web-ext.config.example.ts](docs/development/web-ext.config.example.ts).

WXT writes the development extension to `.output/chrome-mv3` and keeps generated type/cache files in `.wxt`. Both are ignored by git.

## Build And Package

```sh
npm run compile
npm run test
npm run build
npm run zip
```

`npm run build` creates the unpacked extension in `.output/chrome-mv3`. `npm run zip` creates a distributable archive under `.output`.

## Manual Install

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome or `vivaldi://extensions` in Vivaldi.
3. Enable developer mode.
4. Load the unpacked extension from `.output/chrome-mv3`.
5. Pin Contexto, open X, and visit a profile such as `https://x.com/liran_tal`.

For day-to-day iteration, prefer `npm run dev` with a persistent browser profile so login state, extension IndexedDB, and DevTools settings survive restarts.

## Documentation

- [Architecture overview](docs/architecture/overview.md)
- [Data model](docs/architecture/data-model.md)
- [Platform adapters](docs/architecture/platform-adapters.md)
- [Storage and sync](docs/architecture/storage-and-sync.md)
- [Security and privacy](docs/architecture/security-privacy.md)
- [Development browser workflow](docs/development/browser-workflow.md)
- Feature docs under [docs/features](docs/features)

## Test Status

Current automated checks:

```sh
npm run compile
npm run test
npm run build
```

Playwright E2E is wired as `npm run test:e2e`, but the first browser-driving specs should be added after the extension is manually validated in Vivaldi/Chrome with real X pages.

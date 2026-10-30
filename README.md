# Contexto

[![CI](https://github.com/lirantal/contexto-web-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/lirantal/contexto-web-extension/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lirantal/contexto-web-extension)](https://github.com/lirantal/contexto-web-extension/releases/latest)
![Chrome and Vivaldi](https://img.shields.io/badge/browsers-Chrome%20%7C%20Vivaldi-4285F4)
![Manifest V3](https://img.shields.io/badge/extension-Manifest%20V3-0f766e)
![Local first](https://img.shields.io/badge/storage-local%20first-0f766e)

Contexto is a local-first browser extension for lightweight CRM and social relationship management on X/Twitter. It is built for Developer Relations and Developer Advocacy workflows where the useful context lives around people: how you met, what they work on, what company they are attached to, notes, tags, circles, and fast ways to search previous public X interactions.

The extension is built with [WXT](https://wxt.dev/), React, TypeScript, and IndexedDB through Dexie. Chrome and Vivaldi are the supported browser targets, sharing one Chromium Manifest V3 bundle.

## Capabilities

| Capability | What you can do |
| --- | --- |
| Relationship context on X | Save role, company, location, website, tags, circles, and how you met from profiles and persistent editors. |
| Feed context | Recognize saved contacts, see relationship summaries, and add quick notes without leaving the feed. |
| Post bookmarks | Capture supported posts, add reminders, and track Handled/Reopen status. |
| Catch-up checkpoints | Search a contact's posts since your last explicit review. |
| Quick X search | Build keyword/date and two-way interaction searches from the toolbar popup or X sidebar. |
| Offline dashboard | Search and filter contacts, edit metadata, and review notes and bookmarks. |
| Data management | Rename and merge tags, circles, and companies; clean up roles and locations in bulk. |
| Backup and restore | Preview JSON imports, merge safely, export recovery backups, and reject stale drafts. |
| Private X Lists import | Use the optional [X Lists CLI](docs/development/x-lists-export.md) to create a local import. |
| Local storage | Keep relationship data in your browser's IndexedDB; no Contexto account or hosted CRM required. |

## Download and install

Download the **contexto-VERSION-chrome.zip** asset from [GitHub Releases](https://github.com/lirantal/contexto-web-extension/releases/latest). The same bundle works in Chrome and Vivaldi; Firefox and Safari are not currently supported. GitHub's source-code archives are not installable extension bundles.

1. Extract the ZIP into a permanent folder.
2. Open `chrome://extensions` or `vivaldi://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Pin Contexto and open X.

To update, export a JSON backup first, replace the files in the **same folder**, then click **Reload** on the existing extension card. Keep the same browser profile and extension installation to preserve local data. Uninstalling the extension can remove its IndexedDB. These are unpacked downloads, not browser-store installations with automatic updates. Each release includes SHA-256 checksums.

## Setup

```sh
npm ci
```

Use Node.js 24 LTS. The WXT scaffold generates extension types during `postinstall`.

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
npm run check
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

For a standalone export of your private X List members into a fresh Contexto installation, see the [X Lists CLI guide](docs/development/x-lists-export.md). Run `npm run x:lists -- --help` for commands.

- [Documentation index](docs/README.md)
- [Architecture overview](docs/architecture/overview.md)
- [Data model](docs/architecture/data-model.md)
- [Platform adapters](docs/architecture/platform-adapters.md)
- [Storage and sync](docs/architecture/storage-and-sync.md)
- [Data integrity and development plan](docs/development/data-integrity.md)
- [Security and privacy](docs/architecture/security-privacy.md)
- [Development browser workflow](docs/development/browser-workflow.md)
- Feature docs under [docs/features](docs/features)

## Quality and releases

`npm run check` runs ESLint, TypeScript checks, the full Vitest suite, a production build, and popup bundle verification. CI also runs real Chromium extension checks for data integrity and sidebar layout against local fixtures. Live X behavior still requires the [manual browser matrix](docs/development/browser-workflow.md).

Every push to main (including merged PRs) runs a gated patch release. Maintainers can also run **Release** manually on main with a patch, minor, or major bump. Releases include a versioned Chromium ZIP, checksums, and generated changelog notes. See [CI and releases](docs/development/releases.md) for versioning, permissions, and recovery.

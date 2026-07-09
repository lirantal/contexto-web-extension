# Browser Development Workflow

Contexto targets Chrome and Vivaldi as Chromium MV3 browsers.

## Fast Loop

Use WXT dev mode:

```sh
npm run dev
```

WXT launches a Chromium browser with the extension installed. Edits rebuild automatically and the development extension reloads.

## Persistent Profile

By default, web-ext can create throwaway profiles. For Contexto, a persistent profile is better because you need X login state, extension IndexedDB, and DevTools settings to survive restarts.

Create a local `web-ext.config.ts` at the repo root. It is ignored by git. Start from [web-ext.config.example.ts](web-ext.config.example.ts), then set your Chrome or Vivaldi binary path.

Common Linux paths to try:

```sh
/usr/bin/google-chrome
/usr/bin/google-chrome-stable
/usr/bin/chromium
/usr/bin/vivaldi
/usr/bin/vivaldi-stable
```

## Manual Unpacked Install

When you want to use your everyday browser profile instead of WXT's launched profile:

```sh
npm run build
```

Then load `.output/chrome-mv3` from `chrome://extensions` or `vivaldi://extensions`.

The tradeoff is that you may need to press Reload on the extension card after each build.

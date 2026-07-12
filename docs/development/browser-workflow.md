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

## Manual QA Matrix

Run the relevant rows in both Chrome and Vivaldi when a change touches browser integration.

| Scenario | Expected result |
| --- | --- |
| Unknown and saved accounts on feed hover cards | Correct handle and display name; the compact summary and Edit launcher do not overlap X controls. |
| Wide and narrow viewports | The editor opens in the Contexto-owned right rail or modal fallback without shifting the hover card. |
| Hover dismissal and editor interaction | Moving away from the X card, typing, clicking fields or the backdrop, and pressing Escape do not close the editor. |
| Save, failed Save, and Cancel | Successful Save and explicit Cancel close the owned editor; failed Save stays open with the draft intact. |
| Full profile page | The inline editor remains visible and shows authoritative saved values. |
| Toolbar popup | Popup content and search controls render at the expected extension width. |
| Extension reload and navigation | Reloaded content scripts remount cleanly without relying on an invalidated extension context. |

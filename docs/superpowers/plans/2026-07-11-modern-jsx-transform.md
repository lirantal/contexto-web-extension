# Modern JSX Transform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate React 19's outdated JSX-transform warning while making release bundles independent of inherited `NODE_ENV` values.

**Architecture:** Remove the global classic JSX override so the installed React plugin uses its automatic runtime. Set `NODE_ENV=production` at the package-script boundary, then verify all generated JavaScript chunks contain neither development JSX calls nor classic-transform `__self` props.

**Tech Stack:** WXT, Vite, React 19, Vitest, Node.js bundle-verification script, cross-env.

## Global Constraints

- Production `build` and `zip` scripts must force `NODE_ENV=production` across shells.
- React must use Vite's automatic JSX runtime; no `jsxRuntime: 'classic'` override may remain.
- The regression verifier must inspect both popup and content-script chunks.
- The release verifier must reject `jsxDEV(` and `__self:` in emitted JavaScript.

---

### Task 1: Define the modern production-build contract

**Files:**
- Modify: `tests/wxt-config.test.ts`
- Modify: `tests/package-scripts.test.ts`

**Interfaces:**
- Consumes: `wxt.config.ts` and `package.json`.
- Produces: regression tests that fail until automatic JSX and explicit production scripts are configured.

- [x] **Step 1: Write failing tests**

```ts
it('uses Vite\'s automatic JSX runtime', () => {
  expect(config.react?.vite?.jsxRuntime).not.toBe('classic');
});

it('forces NODE_ENV=production for release artifacts', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  expect(packageJson.scripts.build).toContain('cross-env NODE_ENV=production');
  expect(packageJson.scripts.zip).toContain('cross-env NODE_ENV=production');
});
```

- [x] **Step 2: Run the targeted tests to verify failure**

Run: `npm test -- tests/wxt-config.test.ts tests/package-scripts.test.ts`

Expected: the configuration test fails because the classic runtime is configured; the package-script test fails because the test file does not yet exist.

- [x] **Step 3: Add the minimal build configuration**

```json
{
  "scripts": {
    "build": "cross-env NODE_ENV=production wxt build -b chrome",
    "zip": "cross-env NODE_ENV=production wxt zip -b chrome"
  },
  "devDependencies": {
    "cross-env": "^7.0.3"
  }
}
```

Remove the `react.vite.jsxRuntime` block from `wxt.config.ts`.

- [x] **Step 4: Re-run targeted tests to verify they pass**

Run: `npm test -- tests/wxt-config.test.ts tests/package-scripts.test.ts`

Expected: 2 test files pass.

### Task 2: Verify all release chunks use production JSX

**Files:**
- Modify: `scripts/verify-popup-bundle.mjs`

**Interfaces:**
- Consumes: `.output/chrome-mv3` after `npm run build`.
- Produces: process exit code 0 only when all emitted JavaScript chunks exclude `jsxDEV(` and `__self:`.

- [x] **Step 1: Add assertions that cover all emitted JavaScript**

```js
const files = await readdir(output, { recursive: true });
for (const file of files.filter((file) => file.endsWith('.js'))) {
  const bundle = await readFile(resolve(output, file), 'utf8');
  if (/\bjsxDEV\s*\(/.test(bundle)) throw new Error(`${file} contains development JSX output`);
  if (/\b__self\s*:/.test(bundle)) throw new Error(`${file} contains classic JSX metadata`);
}
```

- [x] **Step 2: Run a build from a development environment**

Run: `NODE_ENV=development npm run build && npm run verify:popup`

Expected: WXT completes and the verifier reports that all release chunks use the modern production transform.

- [x] **Step 3: Run the full verification suite**

Run: `npm test && npm run compile && NODE_ENV=development npm run build && npm run verify:popup`

Expected: 0 test failures, TypeScript exits 0, production build exits 0, and the verifier exits 0.

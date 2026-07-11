# Compact Toolbar Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit the full quick-search UI inside Chrome's 600-pixel action-popup limit at normal zoom and add an internal right gutter without changing search behavior.

**Architecture:** Keep the existing React markup and compact only the popup CSS. A CSS contract test reads the real stylesheets and locks down the three layout behaviors that jsdom cannot calculate: border-box sizing with an asymmetric gutter, one-line query previews, and fallback body scrolling.

**Tech Stack:** React 19, TypeScript 5.9, CSS, Vitest 4

## Global Constraints

- Keep every search field, helper sentence, query preview, and footer action.
- Keep the native toolbar popup; do not create a detached browser window.
- Target a rendered height below 590 pixels at 100% zoom.
- Preserve vertical scrolling as a fallback for smaller displays and increased zoom.
- Do not change persistence, query generation, disabled states, navigation, or focus order.

---

### Task 1: Lock down the compact-popup layout contract

**Files:**
- Create: `tests/popup-layout.test.ts`

**Interfaces:**
- Consumes: the literal CSS rules in `entrypoints/popup/App.css` and `entrypoints/popup/style.css`
- Produces: regression coverage for popup sizing, preview overflow, and fallback scrolling

- [ ] **Step 1: Write the failing CSS contract tests**

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync(resolve('entrypoints/popup/App.css'), 'utf8');
const globalCss = readFileSync(resolve('entrypoints/popup/style.css'), 'utf8');

function ruleBody(css: string, selector: string) {
  const selectorStart = css.indexOf(`${selector} {`);
  expect(selectorStart, `Missing CSS rule: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = css.indexOf('{', selectorStart) + 1;
  const bodyEnd = css.indexOf('}', bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

describe('popup layout contract', () => {
  it('includes popup padding in its width and reserves a larger right gutter', () => {
    const shell = ruleBody(appCss, '.popup-shell');

    expect(shell).toContain('box-sizing: border-box;');
    expect(shell).toContain('width: 400px;');
    expect(shell).toContain('padding: 10px 20px 10px 12px;');
  });

  it('keeps long query previews on one ellipsized line', () => {
    const preview = ruleBody(appCss, '.search-action small');

    expect(preview).toContain('overflow: hidden;');
    expect(preview).toContain('text-overflow: ellipsis;');
    expect(preview).toContain('white-space: nowrap;');
  });

  it('keeps body scrolling available when the popup exceeds the browser limit', () => {
    const body = ruleBody(globalCss, 'body');

    expect(body).toContain('max-height: 600px;');
    expect(body).toContain('overflow-y: auto;');
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing layout rules**

Run: `npm test -- tests/popup-layout.test.ts`

Expected: FAIL in all three tests because the shell does not use the new sizing/gutter, the unfinished preview rule has no overflow declarations, and `body` has no height/overflow fallback.

- [ ] **Step 3: Commit the red test together with Task 2 after it passes**

No separate commit yet; the test intentionally fails until Task 2 supplies the production styles.

### Task 2: Compact the popup without removing content

**Files:**
- Modify: `entrypoints/popup/App.css`
- Modify: `entrypoints/popup/style.css`
- Test: `tests/popup-layout.test.ts`

**Interfaces:**
- Consumes: the existing class names rendered by `entrypoints/popup/App.tsx`
- Produces: a compact native action-popup layout with fallback scrolling

- [ ] **Step 1: Replace `entrypoints/popup/App.css` with the compact values**

Apply these exact declarations while retaining all existing selectors:

```css
.popup-shell {
  box-sizing: border-box;
  width: 400px;
  min-height: 480px;
  padding: 10px 20px 10px 12px;
}

.popup-shell header,
.popup-shell footer,
.date-row,
.action-grid {
  gap: 8px;
}

.popup-shell header {
  margin-bottom: 9px;
}

.brand-mark {
  width: 34px;
  height: 34px;
}

.popup-shell h1 {
  font-size: 22px;
  line-height: 1.1;
}

.popup-shell p {
  font-size: 12px;
}

.popup-section {
  gap: 7px;
  margin-bottom: 9px;
}

.popup-shell label {
  gap: 3px;
}

.popup-shell input {
  padding: 6px 8px;
}

.popup-shell button,
.popup-shell a {
  min-height: 32px;
  padding: 6px 8px;
}

.popup-shell footer {
  padding-top: 8px;
}

.popup-shell .search-action {
  min-height: 40px;
  padding: 6px 9px;
}

.search-action small {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #667066;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 2: Add fallback scrolling to `entrypoints/popup/style.css`**

```css
body {
  margin: 0;
  min-width: 360px;
  max-height: 600px;
  overflow-y: auto;
}
```

- [ ] **Step 3: Run the focused test and verify it passes**

Run: `npm test -- tests/popup-layout.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 4: Run the full automated verification**

Run: `npm test && npm run compile && npm run build`

Expected: 5 test files pass with 17 tests, TypeScript exits successfully, and WXT produces the Chrome MV3 build successfully.

- [ ] **Step 5: Review the generated diff and confirm scope**

Run: `git diff --check && git diff -- entrypoints/popup/App.css entrypoints/popup/style.css tests/popup-layout.test.ts`

Expected: no whitespace errors; only compact layout declarations, fallback scrolling, and the CSS contract test are present.

- [ ] **Step 6: Commit the implementation**

```bash
git add entrypoints/popup/App.css entrypoints/popup/style.css tests/popup-layout.test.ts docs/superpowers/plans/2026-07-11-compact-toolbar-popup.md
git commit -m "fix: fit search form in toolbar popup"
```

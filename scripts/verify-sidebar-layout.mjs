import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Run the built extension against local markup at a routed X URL. No X login or
// external requests are needed. CDP inspects the production closed shadow root.
const extension = resolve('.output/chrome-mv3');
const profile = await mkdtemp(join(tmpdir(), 'contexto-sidebar-layout-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 10000 });
  await worker.evaluate(() => {
    // Record the real launch request, but open a blank tab so this fixture check
    // never navigates to live X (including extension-created initial requests).
    globalThis.contextoLayoutUrls = [];
    const createTab = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = (options) => {
      globalThis.contextoLayoutUrls.push(options.url);
      return createTab({ ...options, url: 'about:blank' });
    };
  });

  const cases = ['sidebar-constrained-search-shell', 'sidebar-pinned-native-search']
    .flatMap((fixtureName) => ['light', 'dark'].map((theme) => ({ fixtureName, theme })));
  for (const { fixtureName, theme } of cases) {
    const fixture = await readFile(`tests/fixtures/x/${fixtureName}.html`, 'utf8');
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await context.route('**/*', (route) => route.fulfill({
      contentType: 'text/html',
      body: `<style>
        body { margin:0; font-family:Arial,sans-serif; color-scheme:${theme}; background:${theme === 'dark' ? '#000' : '#fff'}; }
        main { display:flex; justify-content:flex-end; min-height:200vh; padding-right:24px; }
      </style><main>${fixture}</main>`,
    }));
    await page.goto('https://x.com/contexto_layout_check');
    const host = page.locator('[data-contexto-surface="sidebar-search"]');
    await host.waitFor();
    await expect(host).toHaveAttribute('data-theme', theme);

    const cdp = await context.newCDPSession(page);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: root.nodeId, selector: '[data-contexto-surface="sidebar-search"]',
    });
    const { node } = await cdp.send('DOM.describeNode', { nodeId, depth: -1, pierce: true });
    assert.equal(node.shadowRoots[0].shadowRootType, 'closed');
    const { object } = await cdp.send('DOM.resolveNode', { nodeId: node.shadowRoots[0].nodeId });
    const inShadow = async (fn) => {
      const result = await cdp.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: fn.toString(),
        returnByValue: true,
      });
      assert.equal(result.exceptionDetails, undefined, 'shadow-root evaluation failed');
      return result.result.value;
    };

    // Control: the previous insertion point overflows above a centered,
    // fixed-height search shell even with the tripled 72px margin.
    const oldTop = await page.evaluate(() => {
      const host = document.querySelector('[data-contexto-surface="sidebar-search"]');
      const form = document.querySelector('form');
      const branch = document.querySelector('[data-testid="sidebar-stack"]');
      form.before(host);
      host.style.cssText = 'margin:72px 0 16px;max-height:none;overflow:visible';
      const oldTop = host.getBoundingClientRect().top;
      branch.before(host);
      host.removeAttribute('style');
      return oldTop;
    });
    assert.ok(oldTop < 0, 'the fixture must reproduce top clipping at the previous insertion point');

    await expect.poll(() => inShadow(function () {
      return this.querySelector('input[aria-label="My X handle"]').disabled;
    })).toBe(false);
    await inShadow(function () { this.querySelector('input[aria-label="My X handle"]').focus(); });
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('layout_viewer');
    await inShadow(function () { this.querySelector('input[role="combobox"]').focus(); });
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('layout_target');
    await page.keyboard.press('Tab');
    await expect.poll(() => inShadow(function () {
      return this.querySelector('.search-action:last-child').disabled;
    })).toBe(false);

    for (const height of [900, 600, 360]) {
      await page.setViewportSize({ width: 1440, height });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector('[data-contexto-surface="sidebar-search"]').scrollTop = 0;
      });
      const bounds = await host.boundingBox();
      assert.ok(bounds.y >= 12, 'workspace top must be visible');
      assert.ok(bounds.y + bounds.height <= height - 12 + 1, 'workspace must fit the viewport');
      if (fixtureName === 'sidebar-pinned-native-search') {
        const searchShell = await page.locator('[data-testid="search-shell"]').boundingBox();
        assert.ok(bounds.y >= searchShell.y + searchShell.height + 12,
          'workspace must start at least 12px below the pinned native search shell');
      }
      const label = await inShadow(function () {
        return this.querySelector('.contexto-sidebar-search label').getBoundingClientRect().toJSON();
      });
      assert.ok(label.top >= bounds.y && label.bottom <= bounds.y + bounds.height);
      assert.ok(await page.evaluate(({ x, y }) =>
        document.elementFromPoint(x, y)?.matches('[data-contexto-surface="sidebar-search"]'),
      { x: label.left + label.width / 2, y: label.top + label.height / 2 }),
      'the first label must be unobscured by native X content');

      await host.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      const lastAction = await inShadow(function () {
        return this.querySelector('.search-action:last-child').getBoundingClientRect().toJSON();
      });
      assert.ok(lastAction.top >= bounds.y && lastAction.bottom <= bounds.y + bounds.height,
        'the last action must be reachable by scrolling inside the workspace');
      const opened = context.waitForEvent('page', { timeout: 10000 });
      await page.mouse.click(lastAction.x + lastAction.width / 2, lastAction.y + lastAction.height / 2);
      const searchPage = await opened;
      const requestedUrl = await worker.evaluate(() => globalThis.contextoLayoutUrls.at(-1));
      assert.equal(new URL(requestedUrl).pathname, '/search');
      assert.ok(new URL(requestedUrl).searchParams.get('q').includes('@layout_target'));
      await searchPage.close();

      const nativeInput = page.locator('[data-testid="SearchBox_Search_Input"]');
      await nativeInput.scrollIntoViewIfNeeded();
      await nativeInput.fill('Native X search still works');
      await expect(nativeInput).toHaveValue('Native X search still works');
      await expect(host).toHaveCount(1);
      console.log(`${fixtureName}, ${theme}, ${height}px: first label unobscured, last action launches, native search usable (old top ${Math.round(oldTop)}px)`);
    }
    await page.close();
    await context.unroute('**/*');
  }
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createXSidebarSearchObserver } from '@/src/x/sidebar-search-observer';
import type { XSurfaceCleanup } from '@/src/x/surface-observer';

const nativeSearchFixture = readFileSync(
  resolve('tests/fixtures/x/sidebar-native-search.html'),
  'utf8',
);

async function flushMutations() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 110));
}

describe('X sidebar search observer', () => {
  it('hides native widgets by default, restores them lower on demand, and reverses every style change', async () => {
    document.body.innerHTML = nativeSearchFixture;
    const modules = Array.from(document.querySelectorAll<HTMLElement>('[data-sidebar-module]'));
    const [news, sports] = modules;
    news.style.display = 'grid';
    news.style.marginTop = '7px';
    const mount = vi.fn(() => vi.fn() as XSurfaceCleanup);
    const observer = createXSidebarSearchObserver({ root: document.body, mount });

    await flushMutations();

    expect(modules.every((module) => module.style.display === 'none')).toBe(true);
    expect(modules.every((module) => module.hasAttribute('data-contexto-native-sidebar-widget'))).toBe(true);
    expect(document.querySelector('[data-testid="SearchBox_Search_Input"]')).toBeVisible();

    observer.setShowNativeWidgets(true);
    expect(news.style.display).toBe('grid');
    expect(news.style.marginTop).toBe('50vh');
    expect(sports.style.display).toBe('');
    expect(sports.style.marginTop).toBe('');

    observer.setShowNativeWidgets(false);
    const replacementSports = document.createElement('section');
    replacementSports.dataset.sidebarModule = 'sports';
    replacementSports.textContent = 'NFL';
    sports.replaceWith(replacementSports);
    await flushMutations();

    expect(sports.style.display).toBe('');
    expect(replacementSports.style.display).toBe('none');

    observer.setShowNativeWidgets(true);
    expect(replacementSports.style.marginTop).toBe('');
    observer.disconnect();
    expect(news.style.display).toBe('grid');
    expect(news.style.marginTop).toBe('7px');
    expect(replacementSports.style.display).toBe('');
    expect(replacementSports.style.marginTop).toBe('');
    expect(news).not.toHaveAttribute('data-contexto-native-sidebar-widget');
    expect(replacementSports).not.toHaveAttribute('data-contexto-native-sidebar-widget');
  });

  it('mounts before native search, remounts when X replaces it, and cleans up on disconnect', async () => {
    document.body.innerHTML = nativeSearchFixture;
    const nativeForm = document.querySelector<HTMLFormElement>('form')!;
    const nativeInput = document.querySelector<HTMLInputElement>('[data-testid="SearchBox_Search_Input"]')!;
    const cleanups: XSurfaceCleanup[] = [];
    const mount = vi.fn((form: HTMLFormElement) => {
      const host = document.createElement('div');
      host.dataset.contextoSurface = 'sidebar-search';
      host.innerHTML = '<section aria-label="Contexto account search">Account search</section><section aria-label="Quick X search">Quick X search</section>';
      form.before(host);
      const cleanup = vi.fn(() => host.remove()) as XSurfaceCleanup;
      cleanup.isConnected = () => host.isConnected && form.isConnected;
      cleanups.push(cleanup);
      return cleanup;
    });
    const observer = createXSidebarSearchObserver({ root: document.body, mount });

    await flushMutations();

    expect(nativeForm.previousElementSibling).toHaveAttribute('data-contexto-surface', 'sidebar-search');
    expect(document.querySelectorAll('[data-contexto-surface="sidebar-search"]')).toHaveLength(1);
    expect(nativeForm.previousElementSibling).toHaveTextContent('Account searchQuick X search');
    expect(nativeInput.getAttribute('data-testid')).toBe('SearchBox_Search_Input');
    expect(mount).toHaveBeenCalledTimes(1);

    const replacementForm = nativeForm.cloneNode(true) as HTMLFormElement;
    nativeForm.replaceWith(replacementForm);
    await flushMutations();

    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    observer.disconnect();
    expect(cleanups[1]).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the native search input is outside a form', async () => {
    document.body.innerHTML = '<input data-testid="SearchBox_Search_Input" type="text" />';
    const mount = vi.fn();
    const observer = createXSidebarSearchObserver({ root: document.body, mount });

    await flushMutations();

    expect(mount).not.toHaveBeenCalled();
    expect(document.querySelector('[data-contexto-surface="sidebar-search"]')).toBeNull();
    observer.disconnect();
  });

  it('leaves unrelated content untouched when the native form is outside a sidebar column', async () => {
    document.body.innerHTML = `
      <form><input data-testid="SearchBox_Search_Input" type="text" /></form>
      <section id="unrelated" style="display:grid">Unrelated</section>`;
    const unrelated = document.querySelector<HTMLElement>('#unrelated')!;
    const mount = vi.fn(() => vi.fn() as XSurfaceCleanup);
    const observer = createXSidebarSearchObserver({ root: document.body, mount });

    await flushMutations();

    expect(mount).toHaveBeenCalledOnce();
    expect(unrelated.style.display).toBe('grid');
    observer.setShowNativeWidgets(false);
    expect(unrelated.style.display).toBe('grid');
    observer.disconnect();
  });
});

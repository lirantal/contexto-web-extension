import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createXSidebarSearchObserver } from '@/src/x/sidebar-search-observer';
import { mountContextoSidebarSearch } from '@/src/x/mount-contexto-sidebar-search';
import type { XSurfaceCleanup } from '@/src/x/surface-observer';

vi.mock('@/src/ui/ContextoSidebarWorkspace', () => ({
  ContextoSidebarWorkspace: () => null,
}));

const nativeSearchFixture = readFileSync(
  resolve('tests/fixtures/x/sidebar-native-search.html'),
  'utf8',
);
const constrainedSearchFixture = readFileSync(
  resolve('tests/fixtures/x/sidebar-constrained-search-shell.html'),
  'utf8',
);

async function flushMutations() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 110));
}

describe('X sidebar search observer', () => {
  it('updates the mounted workspace URL on navigation without remounting', async () => {
    document.body.innerHTML = nativeSearchFixture;
    let url = 'https://x.com/alice';
    const updatePageUrl = vi.fn();
    const cleanup = Object.assign(vi.fn(), { isConnected: () => true, updatePageUrl });
    const mount = vi.fn(() => cleanup);
    const observer = createXSidebarSearchObserver({ root: document.body, mount, currentUrl: () => url });
    await flushMutations();
    expect(updatePageUrl).toHaveBeenLastCalledWith(url);
    url = 'https://x.com/bob/status/123';
    observer.refresh();
    await flushMutations();
    expect(updatePageUrl).toHaveBeenLastCalledWith(url);
    expect(mount).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
    observer.disconnect();
    expect(cleanup).toHaveBeenCalledOnce();
  });

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

  it.each([nativeSearchFixture, constrainedSearchFixture])('mounts outside native search wrappers, remounts on replacement, and cleans up', async (fixture) => {
    document.body.innerHTML = fixture;
    const nativeForm = document.querySelector<HTMLFormElement>('form')!;
    const nativeBranch = document.querySelector<HTMLElement>('[data-testid="sidebar-stack"]')!;
    const searchShell = nativeForm.parentElement!;
    const originalShellStyle = searchShell.getAttribute('style');
    const originalStackStyle = nativeBranch.getAttribute('style');
    const nativeInput = document.querySelector<HTMLInputElement>('[data-testid="SearchBox_Search_Input"]')!;
    const cleanups: XSurfaceCleanup[] = [];
    const mount = vi.fn((form: HTMLFormElement) => {
      const host = document.createElement('div');
      host.dataset.contextoSurface = 'sidebar-search';
      host.innerHTML = '<section aria-label="Contexto account search">Account search</section><section aria-label="Quick X search">Quick X search</section>';
      nativeBranch.before(host);
      const cleanup = vi.fn(() => host.remove()) as XSurfaceCleanup;
      cleanup.isConnected = () => host.isConnected && form.isConnected;
      cleanups.push(cleanup);
      return cleanup;
    });
    const observer = createXSidebarSearchObserver({ root: document.body, mount });

    await flushMutations();

    expect(nativeBranch.previousElementSibling).toHaveAttribute('data-contexto-surface', 'sidebar-search');
    expect(document.querySelectorAll('[data-contexto-surface="sidebar-search"]')).toHaveLength(1);
    expect(nativeBranch.previousElementSibling).toHaveTextContent('Account searchQuick X search');
    expect(searchShell.contains(nativeBranch.previousElementSibling)).toBe(false);
    expect(nativeInput.getAttribute('data-testid')).toBe('SearchBox_Search_Input');
    expect(mount).toHaveBeenCalledTimes(1);

    const replacementForm = nativeForm.cloneNode(true) as HTMLFormElement;
    nativeForm.replaceWith(replacementForm);
    await flushMutations();

    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    observer.disconnect();
    expect(cleanups[1]).toHaveBeenCalledTimes(1);
    expect(searchShell.getAttribute('style')).toBe(originalShellStyle);
    expect(nativeBranch.getAttribute('style')).toBe(originalStackStyle);
  });

  it('preserves drafts on internal search changes and remounts once when the column placement changes', async () => {
    document.body.innerHTML = nativeSearchFixture;
    const nativeForm = document.querySelector<HTMLFormElement>('form')!;
    const cleanups: XSurfaceCleanup[] = [];
    const mount = vi.fn((form: HTMLFormElement) => {
      const mountedCleanup = mountContextoSidebarSearch({
        nativeForm: form,
        send: vi.fn().mockResolvedValue({ ok: true, accounts: [] }),
        css: '.contexto-surface{} .contexto-quick-search{}',
        theme: 'light',
      });
      const cleanup = vi.fn(() => mountedCleanup()) as XSurfaceCleanup;
      cleanup.isConnected = mountedCleanup.isConnected;
      cleanups.push(cleanup);
      return cleanup;
    });
    const observer = createXSidebarSearchObserver({ root: document.body, mount });
    const nativeBranch = document.querySelector<HTMLElement>('[data-testid="sidebar-stack"]')!;
    const expectSingleHostBeforeBranch = () => {
      expect(document.querySelectorAll('[data-contexto-surface="sidebar-search"]')).toHaveLength(1);
      expect(nativeBranch.previousElementSibling).toHaveAttribute('data-contexto-surface', 'sidebar-search');
    };

    await flushMutations();
    expectSingleHostBeforeBranch();
    expect(mount).toHaveBeenCalledTimes(1);

    const reparentedSearch = document.createElement('div');
    nativeForm.parentElement?.append(reparentedSearch);
    reparentedSearch.append(nativeForm);
    await flushMutations();

    expect(cleanups[0]).not.toHaveBeenCalled();
    expect(mount).toHaveBeenCalledTimes(1);
    expectSingleHostBeforeBranch();

    nativeBranch.before(document.createElement('span'));
    await flushMutations();

    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expectSingleHostBeforeBranch();

    const reorderedHost = nativeBranch.previousElementSibling!;
    nativeBranch.after(reorderedHost);
    await flushMutations();

    expect(cleanups[1]).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(3);
    expectSingleHostBeforeBranch();

    const replacementBranch = document.createElement('div');
    nativeBranch.parentElement!.append(replacementBranch);
    replacementBranch.append(nativeForm);
    await flushMutations();
    expect(cleanups[2]).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(4);
    expect(replacementBranch.previousElementSibling).toHaveAttribute('data-contexto-surface', 'sidebar-search');

    observer.disconnect();
    expect(cleanups[3]).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-contexto-surface="sidebar-search"]')).toBeNull();
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

    expect(mount).not.toHaveBeenCalled();
    expect(unrelated.style.display).toBe('grid');
    observer.setShowNativeWidgets(false);
    expect(unrelated.style.display).toBe('grid');
    observer.disconnect();
  });

  it('ignores search inputs outside the validated sidebar when selecting a mount target', async () => {
    document.body.innerHTML = `<form><input data-testid="SearchBox_Search_Input" /></form>${nativeSearchFixture}`;
    const nativeForm = document.querySelector<HTMLFormElement>('[data-testid="sidebarColumn"] form')!;
    const mount = vi.fn(() => vi.fn() as XSurfaceCleanup);
    const observer = createXSidebarSearchObserver({ root: document.body, mount });
    await flushMutations();
    expect(mount).toHaveBeenCalledExactlyOnceWith(nativeForm);
    observer.disconnect();
  });
});

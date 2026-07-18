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
  it('mounts before native search, remounts when X replaces it, and cleans up on disconnect', async () => {
    document.body.innerHTML = nativeSearchFixture;
    const nativeForm = document.querySelector<HTMLFormElement>('form')!;
    const nativeInput = document.querySelector<HTMLInputElement>('[data-testid="SearchBox_Search_Input"]')!;
    const cleanups: XSurfaceCleanup[] = [];
    const mount = vi.fn((form: HTMLFormElement) => {
      const host = document.createElement('div');
      host.dataset.contextoSurface = 'sidebar-search';
      form.before(host);
      const cleanup = vi.fn(() => host.remove()) as XSurfaceCleanup;
      cleanup.isConnected = () => host.isConnected && form.isConnected;
      cleanups.push(cleanup);
      return cleanup;
    });
    const observer = createXSidebarSearchObserver({ root: document.body, mount });

    await flushMutations();

    expect(nativeForm.previousElementSibling).toHaveAttribute('data-contexto-surface', 'sidebar-search');
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
});

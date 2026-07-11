import { describe, expect, it, vi } from 'vitest';
import { createXSurfaceObserver } from '@/src/x/surface-observer';

async function flushMutations() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('X surface observer', () => {
  it('mounts a hover card once and cleans it up when removed', async () => {
    const cleanup = vi.fn();
    const mount = vi.fn(() => cleanup);
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => location.href, mount });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.dataset.testid = 'HoverCard';
    dialog.innerHTML = '<a href="/theo"><span>Theo</span><span>@theo</span></a>';
    document.body.append(dialog);
    await flushMutations();
    expect(mount).toHaveBeenCalledTimes(1);
    dialog.append(document.createElement('span'));
    await flushMutations();
    expect(mount).toHaveBeenCalledTimes(1);
    dialog.remove();
    await flushMutations();
    expect(cleanup).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });

  it('mounts a full profile when the current URL is a profile', async () => {
    const mount = vi.fn(() => vi.fn());
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/exampledev', mount });
    document.body.innerHTML = '<main data-testid="primaryColumn"><div data-testid="UserName"><span>Example</span><span>@exampledev</span></div></main>';
    await flushMutations();
    expect(mount).toHaveBeenCalledWith(expect.objectContaining({ kind: 'full-profile' }));
    observer.disconnect();
  });
});

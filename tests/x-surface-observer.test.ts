import { describe, expect, it, vi } from 'vitest';
import { createXSurfaceObserver, type XSurfaceCleanup } from '@/src/x/surface-observer';

async function flushMutations() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 110));
}

describe('X surface observer', () => {
  it('debounces mutation bursts before scanning X surfaces', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    const querySelectorAll = vi.spyOn(document.body, 'querySelectorAll');
    let observer: ReturnType<typeof createXSurfaceObserver> | undefined;
    try {
      observer = createXSurfaceObserver({
        root: document.body,
        currentUrl: () => 'https://x.com/home',
        mount: vi.fn(() => vi.fn()),
      });

      for (let index = 0; index < 50; index += 1) {
        document.body.append(document.createElement('div'));
      }
      await Promise.resolve();

      expect(querySelectorAll).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(99);
      expect(querySelectorAll).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(querySelectorAll).toHaveBeenCalledTimes(1);
    } finally {
      observer?.disconnect();
      vi.useRealTimers();
    }
  });

  it('mounts a hover card once and cleans it up when removed', async () => {
    document.body.innerHTML = '';
    const cleanup = vi.fn();
    const mount = vi.fn(() => cleanup);
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => location.href, mount });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<a href="/theo"><img src="https://pbs.twimg.com/profile_images/theo.jpg"></a><div data-testid="UserName"><span>Theo</span><span>@theo</span></div>';
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

  it('remounts the same profile when X replaces the mounted inner subtree', async () => {
    document.body.innerHTML = '';
    const cleanups: XSurfaceCleanup[] = [];
    const mount = vi.fn((surface: { host: HTMLElement }) => {
      const marker = document.createElement('div');
      marker.dataset.contextoSurface = 'hover-card';
      surface.host.querySelector('[data-testid="inner"]')!.append(marker);
      const cleanup = vi.fn(() => marker.remove()) as XSurfaceCleanup;
      cleanup.isConnected = () => marker.isConnected && surface.host.contains(marker);
      cleanups.push(cleanup);
      return cleanup;
    });
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => location.href, mount });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = `<div data-testid="inner">
      <a href="/theo"><img src="https://pbs.twimg.com/profile_images/theo.jpg"></a>
      <div data-testid="UserName"><span>Theo</span><span>@theo</span></div>
    </div>`;
    document.body.append(dialog);
    await flushMutations();
    expect(mount).toHaveBeenCalledTimes(1);
    dialog.innerHTML = '<div data-testid="inner"><a href="/theo"><img src="https://pbs.twimg.com/profile_images/theo.jpg"></a><div data-testid="UserName"><span>Theo</span><span>@theo</span></div></div>';
    await flushMutations();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });

  it('mounts a full profile when the current URL is a profile', async () => {
    document.body.innerHTML = '';
    const mount = vi.fn(() => vi.fn());
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/exampledev', mount });
    document.body.innerHTML = '<main data-testid="primaryColumn"><section data-testid="profileHeader"><div data-testid="UserName"><span>Example</span><span>@exampledev</span></div></section></main>';
    await flushMutations();
    expect(mount).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'full-profile', host: document.querySelector('[data-testid="profileHeader"]'),
    }));
    observer.disconnect();
  });

  it('ignores unrelated dialogs that merely contain a profile link', async () => {
    document.body.innerHTML = '';
    const mount = vi.fn(() => vi.fn());
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/home', mount });
    document.body.innerHTML = '<div role="dialog"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>';
    await flushMutations();
    expect(mount).not.toHaveBeenCalled();
    observer.disconnect();
  });


  it('ignores an unrelated dialog that contains both an avatar and profile link', async () => {
    document.body.innerHTML = '';
    const mount = vi.fn(() => vi.fn());
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/home', mount });
    document.body.innerHTML = '<div role="dialog"><img src="https://pbs.twimg.com/profile_images/theo.jpg"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>';
    await flushMutations();
    expect(mount).not.toHaveBeenCalled();
    observer.disconnect();
  });
  it('remounts a reused profile host when SPA identity changes', async () => {
    document.body.innerHTML = '';
    let url = 'https://x.com/firstdev';
    const cleanup = vi.fn();
    const mount = vi.fn(() => cleanup);
    const onPageContextChange = vi.fn();
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => url, mount, onPageContextChange });
    document.body.innerHTML = '<main data-testid="primaryColumn"><section><div data-testid="UserName"><span>First</span><span>@firstdev</span></div></section></main>';
    await flushMutations();
    expect(mount).toHaveBeenCalledTimes(1);
    url = 'https://x.com/seconddev';
    document.querySelector('[data-testid="UserName"]')!.innerHTML = '<span>Second</span><span>@seconddev</span>';
    await flushMutations();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount).toHaveBeenLastCalledWith(expect.objectContaining({
      profile: expect.objectContaining({ handle: 'seconddev' }),
    }));
    expect(onPageContextChange).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createXSurfaceObserver } from '@/src/x/surface-observer';

async function flushMutations() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 110));
}

describe('X feed post observer', () => {
  it('mounts a top-level feed post once and remounts a recycled host for a new author', async () => {
    document.body.innerHTML = '<article data-testid="tweet"><div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div><a href="/theo/status/123"><time>2h</time></a><div data-testid="tweetText">Post text</div></article>';
    const cleanups = [vi.fn(), vi.fn()];
    let mountCount = 0;
    const mount = vi.fn(() => cleanups[mountCount++]);
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/home', mount });
    await flushMutations();
    const post = document.querySelector('[data-testid="tweet"]');
    expect(mount).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'feed-post', host: post,
      profile: expect.objectContaining({ handle: 'theo' }),
      post: {
        platform: 'x',
        authorHandle: 'theo',
        postId: '123',
        postUrl: 'https://x.com/theo/status/123',
        excerpt: 'Post text',
      },
    }));

    post!.querySelector('[data-testid="User-Name"]')!.innerHTML = '<a href="/other"><span>Other</span><span>@other</span></a>';
    await flushMutations();
    expect(cleanups[0]).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount).toHaveBeenLastCalledWith(expect.objectContaining({ profile: expect.objectContaining({ handle: 'other' }) }));
    observer.disconnect();
  });

  it('remounts a recycled host when the same author changes posts', async () => {
    document.body.innerHTML = '<article data-testid="tweet"><div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div><a class="status" href="/theo/status/123"><time>2h</time></a></article>';
    const cleanups = [vi.fn(), vi.fn()];
    let mountCount = 0;
    const mount = vi.fn(() => cleanups[mountCount++]);
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/home', mount });
    await flushMutations();

    document.querySelector<HTMLAnchorElement>('.status')!.href = '/theo/status/456';
    document.querySelector<HTMLAnchorElement>('.status')!.setAttribute('href', '/theo/status/456');
    document.querySelector<HTMLTimeElement>('time')!.textContent = '1h';
    await flushMutations();

    expect(cleanups[0]).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount).toHaveBeenLastCalledWith(expect.objectContaining({
      post: expect.objectContaining({ postId: '456' }),
    }));
    observer.disconnect();
  });

  it('still mounts saved-contact context when no safe post snapshot exists', async () => {
    document.body.innerHTML = '<article data-testid="tweet"><div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div></article>';
    const mount = vi.fn(() => vi.fn());
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/home', mount });
    await flushMutations();
    expect(mount).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'feed-post',
      profile: expect.objectContaining({ handle: 'theo' }),
      post: undefined,
    }));
    observer.disconnect();
  });

  it('cleans up a disconnected feed post', async () => {
    document.body.innerHTML = '<article data-testid="tweet"><div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div></article>';
    const cleanup = vi.fn();
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/home', mount: vi.fn(() => cleanup) });
    await flushMutations();
    document.querySelector('[data-testid="tweet"]')!.remove();
    await flushMutations();
    expect(cleanup).toHaveBeenCalledOnce();
    observer.disconnect();
  });

  it('ignores nested quoted authors and promoted feed posts', async () => {
    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="tweet"><div data-testid="User-Name"><a href="/quoted"><span>Quoted</span><span>@quoted</span></a></div></div>
      </article>
      <article data-testid="tweet">
        <div data-testid="placementTracking"></div>
        <div data-testid="User-Name"><a href="/promoted"><span>Promoted</span><span>@promoted</span></a></div>
      </article>`;
    const mount = vi.fn(() => vi.fn());
    const observer = createXSurfaceObserver({ root: document.body, currentUrl: () => 'https://x.com/home', mount });
    await flushMutations();
    expect(mount).not.toHaveBeenCalled();
    observer.disconnect();
  });
});

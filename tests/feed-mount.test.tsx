import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { detectXTheme, mountContextoSurface } from '@/src/x/mount-contexto-surface';
import { AccountDraftStore } from '@/src/x/draft-store';

vi.mock('@/src/ui/ContextoProfileSurface', () => ({
  ContextoProfileSurface: () => <div>Full Contexto editor</div>,
}));

vi.mock('@/src/ui/ContextoHoverLauncher', () => ({
  ContextoHoverLauncher: () => <div>Hover Contexto launcher</div>,
}));

vi.mock('@/src/ui/ContextoFeedContext', () => ({
  ContextoFeedContext: ({ post }: { post?: { postUrl: string } }) => (
    <div>Feed Contexto context {post?.postUrl ?? 'no post snapshot'}</div>
  ),
}));

describe('feed-post Contexto surface mounting', () => {
  it('mounts inside the validated author header and cleans up', () => {
    const host = document.createElement('article');
    host.dataset.testid = 'tweet';
    host.innerHTML = '<div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a><time>2h</time></div><a href="/theo/status/123"><time>2h</time></a><div data-testid="tweetText">Post text</div>';
    document.body.append(host);
    const author = host.querySelector<HTMLElement>('[data-testid="User-Name"]')!;
    const cleanup = mountContextoSurface({
      surface: {
        kind: 'feed-post',
        host,
        profile: { platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo' },
        post: {
          platform: 'x', authorHandle: 'theo', postId: '123',
          postUrl: 'https://x.com/theo/status/123', excerpt: 'Post text',
        },
      },
      send: vi.fn(), drafts: new AccountDraftStore(), css: '.contexto-surface{}', theme: 'dark', openPageEditor: vi.fn(),
    });
    const mountHost = host.querySelector<HTMLElement>('[data-contexto-surface="feed-post"]');
    expect(mountHost?.parentElement).toBe(author);
    expect(mountHost?.shadowRoot).toHaveTextContent('Feed Contexto context');
    expect(mountHost?.shadowRoot).toHaveTextContent('https://x.com/theo/status/123');
    expect(mountHost?.shadowRoot).not.toHaveTextContent('Full Contexto editor');
    expect(mountHost?.shadowRoot).not.toHaveTextContent('Hover Contexto launcher');
    cleanup();
    expect(host.querySelector('[data-contexto-surface="feed-post"]')).toBeNull();
  });

  it('returns a disconnected cleanup when author placement is unsafe', () => {
    const host = document.createElement('article');
    host.dataset.testid = 'tweet';
    host.innerHTML = '<div data-testid="User-Name"><span>Theo</span><span>@theo</span></div>';
    document.body.append(host);
    const cleanup = mountContextoSurface({
      surface: { kind: 'feed-post', host, profile: { platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo' } },
      send: vi.fn(), drafts: new AccountDraftStore(), css: '', theme: 'light',
    });
    expect(cleanup.isConnected?.()).toBe(false);
    expect(host.querySelector('[data-contexto-surface="feed-post"]')).toBeNull();
  });
});

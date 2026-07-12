import { describe, expect, it } from 'vitest';
import { extractFeedPostProfile, extractFeedPostSnapshot } from '@/src/x/feed-post-extraction';
import { resolveFeedPostInsertion } from '@/src/x/feed-post-placement';

function createPost(markup: string): HTMLElement {
  const post = document.createElement('article');
  post.dataset.testid = 'tweet';
  post.innerHTML = markup;
  document.body.append(post);
  return post;
}

describe('X feed post extraction', () => {
  it('extracts only the top-level post author', () => {
    const post = createPost(`
      <div data-testid="User-Name" class="primary-author">
        <a href="/theo"><span>Theo</span><span>@theo</span></a>
      </div>
      <div data-testid="tweet">
        <div data-testid="User-Name"><a href="/quoted"><span>Quoted</span><span>@quoted</span></a></div>
      </div>`);

    expect(extractFeedPostProfile(post)).toMatchObject({
      platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo',
    });
  });

  it('extracts a canonical primary post snapshot without quoted content', () => {
    const post = createPost(`
      <div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>
      <a href="/theo/status/123?ref=home"><time>2h</time></a>
      <div data-testid="tweetText">  A useful   release update. </div>
      <div data-testid="tweet">
        <a href="/quoted/status/456"><time>1h</time></a>
        <div data-testid="tweetText">Quoted text</div>
      </div>`);

    expect(extractFeedPostSnapshot(post)).toEqual({
      platform: 'x',
      authorHandle: 'theo',
      postId: '123',
      postUrl: 'https://x.com/theo/status/123',
      excerpt: 'A useful release update.',
    });
  });

  it('fails closed for ambiguous, mismatched, quoted-only, or promoted post sources', () => {
    const ambiguous = createPost(`
      <div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>
      <a href="/theo/status/123"><time>2h</time></a>
      <a href="/theo/status/456"><time>1h</time></a>`);
    expect(extractFeedPostSnapshot(ambiguous)).toBeNull();

    const mismatched = createPost(`
      <div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>
      <a href="/other/status/123"><time>2h</time></a>`);
    expect(extractFeedPostSnapshot(mismatched)).toBeNull();

    const quotedOnly = createPost(`
      <div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>
      <div data-testid="tweet"><a href="/quoted/status/456"><time>1h</time></a><div data-testid="tweetText">Quoted text</div></div>`);
    expect(extractFeedPostSnapshot(quotedOnly)).toBeNull();

    const promoted = createPost(`
      <div data-testid="placementTracking"><span aria-label="Promoted">Promoted</span></div>
      <div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>
      <a href="/theo/status/123"><time>2h</time></a>`);
    expect(extractFeedPostSnapshot(promoted)).toBeNull();
  });

  it('rejects reply-target and quoted identities when they are the only nested identity', () => {
    const post = createPost(`
      <div data-testid="tweet">
        <div data-testid="User-Name"><a href="/reply-target"><span>Reply Target</span><span>@reply_target</span></a></div>
      </div>`);

    expect(extractFeedPostProfile(post)).toBeNull();
  });

  it('rejects promoted posts', () => {
    const post = createPost(`
      <div data-testid="placementTracking"><span aria-label="Promoted">Promoted</span></div>
      <div data-testid="User-Name"><a href="/theo"><span>Theo</span><span>@theo</span></a></div>`);

    expect(extractFeedPostProfile(post)).toBeNull();
  });

  it('fails closed when the handle and exact profile link disagree', () => {
    const post = createPost(`
      <div data-testid="User-Name"><a href="/other"><span>Theo</span><span>@theo</span></a></div>`);

    expect(extractFeedPostProfile(post)).toBeNull();
  });

  it('resolves an in-flow insertion point inside the validated author block', () => {
    const post = createPost(`
      <div data-testid="User-Name" class="primary-author">
        <a href="/theo"><span>Theo</span><span>@theo</span></a>
        <time>2h</time>
      </div>`);
    const author = post.querySelector<HTMLElement>('.primary-author')!;

    expect(resolveFeedPostInsertion(post, 'theo')).toEqual({ parent: author, before: null });
  });

  it('returns no insertion point when the exact author identity is absent', () => {
    const post = createPost('<div data-testid="User-Name"><span>Theo</span><span>@theo</span></div>');

    expect(resolveFeedPostInsertion(post, 'theo')).toBeNull();
  });
});

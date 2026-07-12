import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFeedPostProfile, extractFeedPostSnapshot } from '@/src/x/feed-post-extraction';

const fixture = readFileSync(resolve('tests/fixtures/x/feed-post-primary-author.html'), 'utf8');

describe('X feed post fixtures', () => {
  it('extracts the protected primary-author behavior from the observed fixture', () => {
    const post = document.createElement('article');
    post.innerHTML = fixture;
    const root = post.firstElementChild as HTMLElement;
    expect(extractFeedPostProfile(root)).toMatchObject({ handle: 'theo', displayName: 'Theo' });
    expect(extractFeedPostSnapshot(root)).toEqual({
      platform: 'x', authorHandle: 'theo', postId: '123',
      postUrl: 'https://x.com/theo/status/123', excerpt: 'A visible post body worth remembering.',
    });
  });
});

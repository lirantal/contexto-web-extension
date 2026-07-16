import { describe, expect, it } from 'vitest';
import {
  buildXCatchUpSearchUrl,
  buildXInteractionSearchUrl,
  buildXSearchQuery,
  buildXSearchUrl,
  canRunXSearch,
  normalizeXHandle,
  parseXPostUrl,
  parseXProfileUrl,
} from '@/src/shared/platforms/x';

const baseFilters = {
  viewerHandle: '@liran_tal',
  targetHandle: '@example_dev',
  keyword: 'security',
  since: '2026-01-01',
  until: '2026-02-01',
} as const;

describe('X platform adapter', () => {
  it('normalizes handles', () => {
    expect(normalizeXHandle('@Liran_Tal')).toBe('liran_tal');
  });

  it('parses profile URLs and rejects reserved paths', () => {
    expect(parseXProfileUrl('https://x.com/liran_tal')?.handle).toBe('liran_tal');
    expect(parseXProfileUrl('https://x.com/messages')).toBeNull();
  });

  it('canonicalizes supported X post URLs and rejects unsafe shapes', () => {
    expect(parseXPostUrl('https://twitter.com/Theo/status/123?ref=home#x')).toEqual({
      handle: 'theo',
      postId: '123',
      postUrl: 'https://x.com/theo/status/123',
    });
    expect(parseXPostUrl('/Theo/status/123')).toEqual({
      handle: 'theo',
      postId: '123',
      postUrl: 'https://x.com/theo/status/123',
    });
    expect(parseXPostUrl('https://example.com/theo/status/123')).toBeNull();
    expect(parseXPostUrl('https://x.com/theo/status/not-numeric')).toBeNull();
    expect(parseXPostUrl('https://x.com/messages/status/123')).toBeNull();
  });

  it('builds profile search queries', () => {
    expect(buildXSearchQuery({ ...baseFilters, direction: 'me-to-them' })).toBe(
      'from:liran_tal to:example_dev security since:2026-01-01 until:2026-02-01',
    );
    expect(buildXSearchQuery({ ...baseFilters, direction: 'them-to-me' })).toContain('from:example_dev to:liran_tal');
  });

  it('builds useful searches with only my handle', () => {
    const filters = { viewerHandle: '@liran_tal', targetHandle: '', keyword: '', since: '', until: '' };

    expect(buildXSearchQuery({ ...filters, direction: 'me-to-them' })).toBe('from:liran_tal');
    expect(buildXSearchQuery({ ...filters, direction: 'them-to-me' })).toBe('to:liran_tal');
  });

  it('requires the handle used by each search action', () => {
    expect(canRunXSearch({ viewerHandle: '@liran_tal', targetHandle: '', direction: 'me-to-them' })).toBe(true);
    expect(canRunXSearch({ viewerHandle: '', targetHandle: '@example_dev', direction: 'me-to-them' })).toBe(false);
    expect(canRunXSearch({ viewerHandle: '', targetHandle: '@example_dev', direction: 'from-profile' })).toBe(true);
    expect(canRunXSearch({ viewerHandle: '@liran_tal', targetHandle: '', direction: 'from-profile' })).toBe(false);
    expect(canRunXSearch({ viewerHandle: '', targetHandle: '@example_dev', direction: 'mentions' })).toBe(true);
  });

  it('encodes X search URLs', () => {
    const url = buildXSearchUrl({ ...baseFilters, direction: 'mentions' });
    expect(url).toContain('https://x.com/search?');
    expect(decodeURIComponent(url)).toContain('@example_dev');
  });

  it('builds a normalized live search for interactions in both directions', () => {
    const url = buildXInteractionSearchUrl('@Liran_Tal', '@Example_Dev');

    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.origin + parsed.pathname).toBe('https://x.com/search');
    expect(parsed.searchParams.get('q')).toBe(
      '(from:liran_tal to:example_dev) OR (from:example_dev to:liran_tal)',
    );
    expect(parsed.searchParams.get('src')).toBe('typed_query');
    expect(parsed.searchParams.get('f')).toBe('live');
  });

  it('omits an interaction search when either handle is invalid', () => {
    expect(buildXInteractionSearchUrl('', 'example_dev')).toBeNull();
    expect(buildXInteractionSearchUrl('liran_tal', 'not-valid!')).toBeNull();
  });

  it('builds a live author catch-up search from the last explicit checkpoint', () => {
    const url = buildXCatchUpSearchUrl('@Example_Dev', '2026-07-10T18:42:00.000Z');

    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.searchParams.get('q')).toBe('from:example_dev since:2026-07-10');
    expect(parsed.searchParams.get('f')).toBe('live');
  });

  it('builds a complete author search before the first checkpoint and rejects invalid input', () => {
    const firstCatchUp = buildXCatchUpSearchUrl('Example_Dev');

    expect(new URL(firstCatchUp!).searchParams.get('q')).toBe('from:example_dev');
    expect(buildXCatchUpSearchUrl('not-valid!')).toBeNull();
    expect(buildXCatchUpSearchUrl('example_dev', 'not-a-timestamp')).toBeNull();
  });
});

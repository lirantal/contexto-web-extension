import { describe, expect, it } from 'vitest';
import { buildXSearchQuery, buildXSearchUrl, normalizeXHandle, parseXProfileUrl } from '@/src/shared/platforms/x';

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

  it('builds profile search queries', () => {
    expect(buildXSearchQuery({ ...baseFilters, direction: 'me-to-them' })).toBe(
      'from:liran_tal to:example_dev security since:2026-01-01 until:2026-02-01',
    );
    expect(buildXSearchQuery({ ...baseFilters, direction: 'them-to-me' })).toContain('from:example_dev to:liran_tal');
  });

  it('encodes X search URLs', () => {
    const url = buildXSearchUrl({ ...baseFilters, direction: 'mentions' });
    expect(url).toContain('https://x.com/search?');
    expect(decodeURIComponent(url)).toContain('@example_dev');
  });
});

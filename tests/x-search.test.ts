import { describe, expect, it } from 'vitest';
import {
  buildXSearchQuery,
  buildXSearchUrl,
  canRunXSearch,
  normalizeXHandle,
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
});

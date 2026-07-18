import { describe, expect, it } from 'vitest';
import { searchSidebarAccounts } from '@/src/shared/sidebar-account-search';
import type { AccountSummary } from '@/src/shared/types';

const account = (handle: string, displayName: string): AccountSummary => ({
  id: handle,
  platform: 'x',
  handle,
  normalizedHandle: handle.toLowerCase(),
  displayName,
  profileUrl: `https://x.com/${handle}`,
  syncState: 'local-only',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
  tags: [],
  folders: [],
});

describe('searchSidebarAccounts', () => {
  const accounts = [
    account('liran_tal', 'Liran Tal'),
    account('lirandev', 'Liran Developer'),
    account('alex', 'Alicia Example'),
    { ...account('outside', 'Liran in company only'), platform: 'linkedin' as const },
  ];

  it('ranks exact and prefix handle matches before display-name matches', () => {
    expect(searchSidebarAccounts(accounts, '@liran').map(({ handle }) => handle))
      .toEqual(['liran_tal', 'lirandev']);
  });

  it('matches ordered characters and ignores non-X accounts', () => {
    expect(searchSidebarAccounts(accounts, 'aex').map(({ handle }) => handle)).toEqual(['alex']);
  });

  it('does not match metadata outside display names and handles', () => {
    const onlyCompany = {
      ...account('theo', 'Theo'),
      company: {
        name: 'Liran',
        id: 'company',
        normalizedName: 'liran',
        createdAt: '',
        updatedAt: '',
      },
    };

    expect(searchSidebarAccounts([onlyCompany], 'liran')).toEqual([]);
  });

  it('limits results to five by default', () => {
    expect(searchSidebarAccounts(Array.from({ length: 6 }, (_, index) =>
      account(`person${index}`, `Person ${index}`)), 'person')).toHaveLength(5);
  });
});

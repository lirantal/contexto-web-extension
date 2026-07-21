import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { searchSidebarAccounts } from '@/src/shared/sidebar-account-search';
import { ContextoSidebarAccountSearch } from '@/src/ui/ContextoSidebarAccountSearch';
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
      .toEqual(['lirandev', 'liran_tal']);
  });

  it('uses display name then normalized handle to order equal-score matches', () => {
    const laterUpdated = { ...account('zoe', 'Same'), updatedAt: '2026-07-19T00:00:00.000Z' };
    const earlierUpdated = { ...account('amy', 'Same'), updatedAt: '2026-07-18T00:00:00.000Z' };

    expect(searchSidebarAccounts([laterUpdated, earlierUpdated], 'same').map(({ handle }) => handle))
      .toEqual(['amy', 'zoe']);
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

describe('ContextoSidebarAccountSearch', () => {
  it('shows a fuzzy saved-account match and navigates in the current tab', async () => {
    const navigate = vi.fn();
    render(<ContextoSidebarAccountSearch
      navigate={navigate}
      send={vi.fn().mockResolvedValue({ ok: true, accounts: [account('liran_tal', 'Liran Tal')] })}
    />);

    fireEvent.change(await screen.findByLabelText('Search Contexto accounts'), { target: { value: 'lir' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Liran Tal @liran_tal' }));

    expect(navigate).toHaveBeenCalledWith('https://x.com/liran_tal');
  });

  it('shows loading status and disables the query while saved accounts load', async () => {
    let resolveAccounts: (response: { ok: true; accounts: AccountSummary[] }) => void;
    const accounts = new Promise<{ ok: true; accounts: AccountSummary[] }>((resolve) => {
      resolveAccounts = resolve;
    });
    render(<ContextoSidebarAccountSearch send={vi.fn().mockReturnValue(accounts)} />);

    expect(await screen.findByText('Loading saved accounts…')).toBeVisible();
    expect(screen.getByLabelText('Search Contexto accounts')).toBeDisabled();

    resolveAccounts!({ ok: true, accounts: [] });
  });

  it('reports an unavailable local index without touching native X search', async () => {
    render(<ContextoSidebarAccountSearch send={vi.fn().mockRejectedValue(new Error('offline'))} />);

    expect(await screen.findByText('Contexto accounts are unavailable.')).toBeVisible();
    expect(screen.getByLabelText('Search Contexto accounts')).toBeDisabled();
  });

  it('shows no results only for an unmatched non-empty query', async () => {
    render(<ContextoSidebarAccountSearch
      send={vi.fn().mockResolvedValue({ ok: true, accounts: [account('theo', 'Theo')] })}
    />);

    fireEvent.change(await screen.findByLabelText('Search Contexto accounts'), { target: { value: 'missing' } });

    await waitFor(() => expect(screen.getByText('No saved accounts found.')).toBeVisible());
  });
});

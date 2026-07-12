import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccountBookmarks } from '@/src/ui/AccountBookmarks';
import type { Bookmark } from '@/src/shared/types';

const bookmark: Bookmark = {
  id: 'bookmark_1',
  accountId: 'account_1',
  platform: 'x',
  postId: '123',
  postUrl: 'https://x.com/theo/status/123',
  excerpt: 'A useful release update.',
  reminder: 'Possible podcast guest',
  capturedAt: '2026-07-12T12:00:00.000Z',
  createdAt: '2026-07-12T12:00:00.000Z',
  updatedAt: '2026-07-12T12:00:00.000Z',
};

describe('AccountBookmarks', () => {
  it('renders rich and sparse bookmarks with safe source links', async () => {
    const sparse = {
      ...bookmark,
      id: 'bookmark_2',
      postId: '456',
      postUrl: 'https://x.com/theo/status/456',
      reminder: undefined,
      excerpt: undefined,
      capturedAt: '2026-07-11T12:00:00.000Z',
    };
    render(<AccountBookmarks accountId="account_1" load={vi.fn().mockResolvedValue([bookmark, sparse])} remove={vi.fn()} />);

    expect(await screen.findByText('Possible podcast guest')).toBeVisible();
    expect(screen.getByText('A useful release update.')).toBeVisible();
    expect(screen.getAllByText(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(bookmark.capturedAt)))).toHaveLength(1);
    const links = await screen.findAllByRole('link', { name: 'Open on X' });
    expect(links[0]).toHaveAttribute('href', bookmark.postUrl);
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noreferrer');
    expect(links[1]).toHaveAttribute('href', sparse.postUrl);
  });

  it('shows an empty capture hint', async () => {
    render(<AccountBookmarks accountId="account_1" load={vi.fn().mockResolvedValue([])} remove={vi.fn()} />);
    expect(await screen.findByText(/Capture posts from saved contacts on X/i)).toBeVisible();
  });

  it('removes successfully and preserves the card when removal fails', async () => {
    const load = vi.fn().mockResolvedValueOnce([bookmark]).mockResolvedValueOnce([]);
    const remove = vi.fn().mockResolvedValue(undefined);
    render(<AccountBookmarks accountId="account_1" load={load} remove={remove} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Remove bookmark' }));
    expect(remove).toHaveBeenCalledWith('bookmark_1');
    expect(await screen.findByText(/Capture posts from saved contacts on X/i)).toBeVisible();

    const failingRemove = vi.fn().mockRejectedValue(new Error('Could not remove bookmark'));
    render(<AccountBookmarks accountId="account_2" load={vi.fn().mockResolvedValue([{ ...bookmark, accountId: 'account_2' }])} remove={failingRemove} />);
    await user.click((await screen.findAllByRole('button', { name: 'Remove bookmark' })).at(-1)!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not remove bookmark');
    expect(screen.getByText('Possible podcast guest')).toBeVisible();
  });

  it('ignores stale bookmark loads after switching contacts', async () => {
    let resolveFirst!: (bookmarks: Bookmark[]) => void;
    const firstLoad = new Promise<Bookmark[]>((resolve) => { resolveFirst = resolve; });
    const second = { ...bookmark, id: 'bookmark_2', accountId: 'account_2', reminder: 'Second contact' };
    const load = vi.fn((accountId: string) => accountId === 'account_1' ? firstLoad : Promise.resolve([second]));
    const { rerender } = render(<AccountBookmarks accountId="account_1" load={load} remove={vi.fn()} />);
    rerender(<AccountBookmarks accountId="account_2" load={load} remove={vi.fn()} />);
    expect(await screen.findByText('Second contact')).toBeVisible();
    resolveFirst([bookmark]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('Possible podcast guest')).not.toBeInTheDocument();
  });

  it('does not let an old removal overwrite a newly selected contact', async () => {
    let resolveRemove!: () => void;
    let resolveSecondLoad!: (bookmarks: Bookmark[]) => void;
    const removal = new Promise<void>((resolve) => { resolveRemove = resolve; });
    const secondLoad = new Promise<Bookmark[]>((resolve) => { resolveSecondLoad = resolve; });
    const second = { ...bookmark, id: 'bookmark_2', accountId: 'account_2', reminder: 'Second contact' };
    const load = vi.fn()
      .mockResolvedValueOnce([bookmark])
      .mockReturnValueOnce(secondLoad)
      .mockResolvedValueOnce([bookmark]);
    const remove = vi.fn().mockReturnValue(removal);
    const { rerender } = render(<AccountBookmarks accountId="account_1" load={load} remove={remove} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Remove bookmark' }));

    rerender(<AccountBookmarks accountId="account_2" load={load} remove={remove} />);
    await act(async () => {
      resolveRemove();
      await Promise.resolve();
    });
    await act(async () => {
      resolveSecondLoad([second]);
      await Promise.resolve();
    });

    expect(await screen.findByText('Second contact')).toBeVisible();
    expect(screen.queryByText('Possible podcast guest')).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

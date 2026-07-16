import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositories = vi.hoisted(() => ({
  addNote: vi.fn(),
  captureBookmark: vi.fn(),
  findBookmarkByPost: vi.fn(),
  getAccountByHandle: vi.fn(),
  markAccountCaughtUp: vi.fn(),
  saveAccountContext: vi.fn(),
}));

vi.mock('@/src/data/repositories', () => ({
  addNote: repositories.addNote,
  captureBookmark: repositories.captureBookmark,
  findBookmarkByPost: repositories.findBookmarkByPost,
  getAccountByHandle: repositories.getAccountByHandle,
  markAccountCaughtUp: repositories.markAccountCaughtUp,
  saveAccountContext: repositories.saveAccountContext,
}));

vi.mock('@/src/shared/settings', () => ({
  settingsItem: { getValue: vi.fn(), setValue: vi.fn() },
}));

import { handleRequest } from '@/entrypoints/background';

describe('background account context messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a successful isolated read-only lookup result', async () => {
    repositories.getAccountByHandle.mockResolvedValue({ id: 'account_1' });
    await expect(handleRequest({
      type: 'contexto:account:lookup', platform: 'x', handle: '@missing',
    })).resolves.toEqual({ ok: true, lookup: true, lookupAccount: { id: 'account_1' } });
    expect(repositories.saveAccountContext).not.toHaveBeenCalled();
  });

  it('routes explicit context saves', async () => {
    const input = {
      profile: { platform: 'x' as const, handle: 'dev', profileUrl: 'https://x.com/dev' },
      metadata: { displayName: 'Dev' }, tagNames: ['Security'], folderNames: ['Friends'],
    };
    repositories.saveAccountContext.mockResolvedValue({ id: 'account_1', tags: [], folders: [] });
    await handleRequest({ type: 'contexto:account:saveContext', input });
    expect(repositories.saveAccountContext).toHaveBeenCalledWith(input);
  });

  it('routes an explicit catch-up checkpoint without accepting a caller timestamp', async () => {
    const updated = { id: 'account_1', lastCatchUpAt: '2026-07-16T10:15:00.000Z' };
    repositories.markAccountCaughtUp.mockResolvedValue(updated);

    await expect(handleRequest({
      type: 'contexto:account:markCaughtUp', accountId: 'account_1',
    })).resolves.toEqual({ ok: true, account: updated });
    expect(repositories.markAccountCaughtUp).toHaveBeenCalledWith('account_1');
  });

  it('routes an explicit relationship note and returns refreshed account context', async () => {
    const updated = { id: 'account_1', latestNote: { body: 'Follow up after launch' } };
    repositories.addNote.mockResolvedValue(updated);

    await expect(handleRequest({
      type: 'contexto:note:add',
      accountId: 'account_1',
      body: 'Follow up after launch',
    })).resolves.toEqual({ ok: true, account: updated });
    expect(repositories.addNote).toHaveBeenCalledWith('account_1', 'Follow up after launch');
  });

  it('routes bookmark lookup and capture without creating an account', async () => {
    const existing = { id: 'bookmark_1', postUrl: 'https://x.com/dev/status/123' };
    repositories.findBookmarkByPost.mockResolvedValue(existing);
    await expect(handleRequest({
      type: 'contexto:bookmark:lookup',
      accountId: 'account_1',
      postUrl: 'https://x.com/dev/status/123',
    })).resolves.toEqual({ ok: true, bookmarkLookup: true, lookupBookmark: existing });
    expect(repositories.findBookmarkByPost).toHaveBeenCalledWith(
      'account_1',
      'https://x.com/dev/status/123',
    );

    const created = { ...existing, reminder: 'Possible guest' };
    repositories.captureBookmark.mockResolvedValue(created);
    await expect(handleRequest({
      type: 'contexto:bookmark:capture',
      accountId: 'account_1',
      authorHandle: 'dev',
      postUrl: 'https://x.com/dev/status/123',
      excerpt: 'Release update',
      reminder: 'Possible guest',
    })).resolves.toEqual({ ok: true, bookmark: created });
    expect(repositories.captureBookmark).toHaveBeenCalledWith('account_1', {
      authorHandle: 'dev',
      postUrl: 'https://x.com/dev/status/123',
      excerpt: 'Release update',
      reminder: 'Possible guest',
    });
    expect(repositories.saveAccountContext).not.toHaveBeenCalled();
  });
});

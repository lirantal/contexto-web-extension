import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositories = vi.hoisted(() => ({
  captureBookmark: vi.fn(),
  findBookmarkByPost: vi.fn(),
  getAccountByHandle: vi.fn(),
  saveAccountContext: vi.fn(),
}));

vi.mock('@/src/data/repositories', () => ({
  captureBookmark: repositories.captureBookmark,
  findBookmarkByPost: repositories.findBookmarkByPost,
  getAccountByHandle: repositories.getAccountByHandle,
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

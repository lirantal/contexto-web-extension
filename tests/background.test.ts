import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositories = vi.hoisted(() => ({
  getAccountByHandle: vi.fn(),
  saveAccountContext: vi.fn(),
}));

vi.mock('@/src/data/repositories', () => ({
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
});


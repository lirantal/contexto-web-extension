import { describe, expect, it, vi } from 'vitest';
import { createQuickXSearchPersistence } from '@/src/shared/quick-x-search-persistence';

describe('Quick X search runtime persistence adapter', () => {
  it('maps field patches and target promotion to typed background messages', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        settings: {
          myXHandle: '@me',
          lastDashboardView: 'accounts',
          showNativeXSidebarWidgets: false,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        searchState: { targetHandle: '', keyword: 'security', since: '', until: '' },
      })
      .mockResolvedValueOnce({
        ok: true,
        targetHandleHistory: [{ handle: 'them', searchedAt: '2026-10-19T00:00:00.000Z' }],
      });
    const persistence = createQuickXSearchPersistence(send);

    await expect(persistence.updateSettings({ myXHandle: '@me' })).resolves.toMatchObject({ myXHandle: '@me' });
    await expect(persistence.updateSearchState({ keyword: 'security' })).resolves.toMatchObject({ keyword: 'security' });
    await expect(persistence.promoteTargetHandle('them')).resolves.toEqual([
      { handle: 'them', searchedAt: '2026-10-19T00:00:00.000Z' },
    ]);
    expect(send.mock.calls).toEqual([
      [{ type: 'contexto:settings:update', patch: { myXHandle: '@me' } }],
      [{ type: 'contexto:search-state:update', patch: { keyword: 'security' } }],
      [{ type: 'contexto:target-history:promote', handle: 'them' }],
    ]);
  });

  it('rejects malformed or failed background responses', async () => {
    const failed = createQuickXSearchPersistence(vi.fn().mockResolvedValue({ ok: false, error: 'Storage unavailable' }));
    await expect(failed.updateSearchState({ keyword: 'security' })).rejects.toThrow('Storage unavailable');

    const malformed = createQuickXSearchPersistence(vi.fn().mockResolvedValue({ ok: true }));
    await expect(malformed.promoteTargetHandle('them')).rejects.toThrow('Target history unavailable');
  });
});

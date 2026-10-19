import { describe, expect, it, vi } from 'vitest';
import { createBackgroundRequestHandler } from '@/entrypoints/background';
import type { ContextoSettings, PopupSearchState } from '@/src/shared/types';
import type { TargetHandleHistoryEntry } from '@/src/shared/target-handle-suggestions';

interface MemoryItem<T> {
  getValue: ReturnType<typeof vi.fn<() => Promise<T>>>;
  setValue: ReturnType<typeof vi.fn<(value: T) => Promise<void>>>;
  value: () => T;
}

function createMemoryItem<T>(initial: T): MemoryItem<T> {
  let current = initial;
  return {
    getValue: vi.fn(async () => structuredClone(current)),
    setValue: vi.fn(async (value: T) => {
      current = structuredClone(value);
    }),
    value: () => current,
  };
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createStorage(overrides: {
  settingsItem?: MemoryItem<ContextoSettings>;
  popupSearchStateItem?: MemoryItem<PopupSearchState>;
  targetHandleHistoryItem?: MemoryItem<TargetHandleHistoryEntry[]>;
} = {}) {
  return {
    settingsItem: overrides.settingsItem ?? createMemoryItem<ContextoSettings>({
      myXHandle: '',
      lastDashboardView: 'accounts',
      showNativeXSidebarWidgets: false,
    }),
    popupSearchStateItem: overrides.popupSearchStateItem ?? createMemoryItem<PopupSearchState>({
      targetHandle: '',
      keyword: '',
      since: '',
      until: '',
    }),
    targetHandleHistoryItem: overrides.targetHandleHistoryItem ?? createMemoryItem<TargetHandleHistoryEntry[]>([]),
  };
}

describe('background Quick X search persistence', () => {
  it('patches my handle without erasing unrelated settings fields', async () => {
    const settingsItem = createMemoryItem<ContextoSettings>({
      myXHandle: '@old',
      lastDashboardView: 'settings',
      showNativeXSidebarWidgets: true,
    });
    const storage = createStorage({ settingsItem });
    const handleRequest = createBackgroundRequestHandler(storage);

    await expect(handleRequest({
      type: 'contexto:settings:update',
      patch: { myXHandle: '@new' },
    })).resolves.toEqual({
      ok: true,
      settings: {
        myXHandle: '@new',
        lastDashboardView: 'settings',
        showNativeXSidebarWidgets: true,
      },
    });
    expect(settingsItem.value()).toEqual({
      myXHandle: '@new',
      lastDashboardView: 'settings',
      showNativeXSidebarWidgets: true,
    });
  });

  it('serializes concurrent viewer and dashboard settings patches', async () => {
    const settingsItem = createMemoryItem<ContextoSettings>({
      myXHandle: '@old',
      lastDashboardView: 'settings',
      showNativeXSidebarWidgets: false,
    });
    const firstWriteStarted = createDeferred();
    const releaseFirstWrite = createDeferred();
    const writeValue = settingsItem.setValue.getMockImplementation()!;
    settingsItem.setValue.mockImplementation(async (value) => {
      if (settingsItem.setValue.mock.calls.length === 1) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
      }
      await writeValue(value);
    });
    const handleRequest = createBackgroundRequestHandler(createStorage({ settingsItem }));

    const viewerPatch = handleRequest({
      type: 'contexto:settings:update',
      patch: { myXHandle: '@new' },
    });
    await firstWriteStarted.promise;
    const dashboardPatch = handleRequest({
      type: 'contexto:settings:update',
      patch: { showNativeXSidebarWidgets: true },
    });
    await Promise.resolve();
    const readsBeforeRelease = settingsItem.getValue.mock.calls.length;
    releaseFirstWrite.resolve();

    await expect(Promise.all([viewerPatch, dashboardPatch])).resolves.toEqual([
      {
        ok: true,
        settings: expect.objectContaining({ myXHandle: '@new' }),
      },
      {
        ok: true,
        settings: expect.objectContaining({ showNativeXSidebarWidgets: true }),
      },
    ]);
    expect(readsBeforeRelease).toBe(1);
    expect(settingsItem.value()).toEqual({
      myXHandle: '@new',
      lastDashboardView: 'settings',
      showNativeXSidebarWidgets: true,
    });
  });

  it('serializes independent popup and sidebar search-state field patches', async () => {
    const popupSearchStateItem = createMemoryItem<PopupSearchState>({
      targetHandle: '@persisted',
      keyword: 'original',
      since: '2026-01-01',
      until: '2026-02-01',
    });
    const firstWriteStarted = createDeferred();
    const releaseFirstWrite = createDeferred();
    const writeValue = popupSearchStateItem.setValue.getMockImplementation()!;
    popupSearchStateItem.setValue.mockImplementation(async (value) => {
      if (popupSearchStateItem.setValue.mock.calls.length === 1) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
      }
      await writeValue(value);
    });
    const storage = createStorage({ popupSearchStateItem });
    const handleRequest = createBackgroundRequestHandler(storage);

    const popupPatch = handleRequest({
      type: 'contexto:search-state:update',
      patch: { keyword: 'popup edit' },
    });
    await firstWriteStarted.promise;
    const sidebarPatch = handleRequest({
      type: 'contexto:search-state:update',
      patch: { until: '2026-03-01' },
    });
    await Promise.resolve();
    const readsBeforeRelease = popupSearchStateItem.getValue.mock.calls.length;
    releaseFirstWrite.resolve();

    await expect(Promise.all([popupPatch, sidebarPatch])).resolves.toEqual([
      { ok: true, searchState: expect.objectContaining({ keyword: 'popup edit' }) },
      { ok: true, searchState: expect.objectContaining({ until: '2026-03-01' }) },
    ]);
    expect(readsBeforeRelease).toBe(1);
    expect(popupSearchStateItem.value()).toEqual({
      targetHandle: '@persisted',
      keyword: 'popup edit',
      since: '2026-01-01',
      until: '2026-03-01',
    });
  });

  it('continues processing search-state patches after a rejected write', async () => {
    const popupSearchStateItem = createMemoryItem<PopupSearchState>({
      targetHandle: '',
      keyword: '',
      since: '',
      until: '',
    });
    const writeValue = popupSearchStateItem.setValue.getMockImplementation()!;
    popupSearchStateItem.setValue
      .mockRejectedValueOnce(new Error('Storage unavailable'))
      .mockImplementation(writeValue);
    const storage = createStorage({ popupSearchStateItem });
    const handleRequest = createBackgroundRequestHandler(storage);

    await expect(handleRequest({
      type: 'contexto:search-state:update',
      patch: { keyword: 'failed' },
    })).resolves.toEqual({ ok: false, error: 'Storage unavailable' });
    await expect(handleRequest({
      type: 'contexto:search-state:update',
      patch: { since: '2026-04-01' },
    })).resolves.toEqual({
      ok: true,
      searchState: { targetHandle: '', keyword: '', since: '2026-04-01', until: '' },
    });
    expect(popupSearchStateItem.setValue).toHaveBeenCalledTimes(2);
  });

  it('serializes concurrent target promotions so both survive in recency order', async () => {
    const targetHandleHistoryItem = createMemoryItem<TargetHandleHistoryEntry[]>([]);
    const firstWriteStarted = createDeferred();
    const releaseFirstWrite = createDeferred();
    const writeValue = targetHandleHistoryItem.setValue.getMockImplementation()!;
    targetHandleHistoryItem.setValue.mockImplementation(async (value) => {
      if (targetHandleHistoryItem.setValue.mock.calls.length === 1) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
      }
      await writeValue(value);
    });
    const storage = createStorage({ targetHandleHistoryItem });
    const now = vi.fn()
      .mockReturnValueOnce('2026-10-19T00:00:00.000Z')
      .mockReturnValueOnce('2026-10-19T00:00:01.000Z');
    const handleRequest = createBackgroundRequestHandler(storage, { now });

    const firstPromotion = handleRequest({
      type: 'contexto:target-history:promote',
      handle: '@Alice',
    });
    await firstWriteStarted.promise;
    const secondPromotion = handleRequest({
      type: 'contexto:target-history:promote',
      handle: '@Bob',
    });
    releaseFirstWrite.resolve();

    await expect(Promise.all([firstPromotion, secondPromotion])).resolves.toEqual([
      {
        ok: true,
        targetHandleHistory: [{ handle: 'alice', searchedAt: '2026-10-19T00:00:00.000Z' }],
      },
      {
        ok: true,
        targetHandleHistory: [
          { handle: 'bob', searchedAt: '2026-10-19T00:00:01.000Z' },
          { handle: 'alice', searchedAt: '2026-10-19T00:00:00.000Z' },
        ],
      },
    ]);
    expect(targetHandleHistoryItem.value()).toEqual([
      { handle: 'bob', searchedAt: '2026-10-19T00:00:01.000Z' },
      { handle: 'alice', searchedAt: '2026-10-19T00:00:00.000Z' },
    ]);
  });
});

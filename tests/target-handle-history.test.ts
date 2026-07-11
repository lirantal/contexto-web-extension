import { beforeEach, describe, expect, it, vi } from 'vitest';

const values = vi.hoisted(() => new Map<string, unknown>());

vi.mock('wxt/utils/storage', () => ({
  storage: {
    defineItem: <T,>(key: string, options: { fallback: T }) => ({
      getValue: vi.fn(async () => values.has(key) ? values.get(key) as T : options.fallback),
      setValue: vi.fn(async (value: T) => { values.set(key, value); }),
    }),
  },
}));

import {
  clearTargetHandleHistory,
  recordTargetHandleSearch,
  targetHandleHistoryItem,
} from '@/src/shared/settings';

describe('target handle history storage', () => {
  beforeEach(() => values.clear());

  it('records a normalized handle and promotes repeat searches', async () => {
    await recordTargetHandleSearch('@Alice_Dev', '2026-07-10T00:00:00Z');
    await recordTargetHandleSearch('other', '2026-07-10T01:00:00Z');
    await recordTargetHandleSearch('ALICE_DEV', '2026-07-11T00:00:00Z');

    await expect(targetHandleHistoryItem.getValue()).resolves.toEqual([
      { handle: 'alice_dev', searchedAt: '2026-07-11T00:00:00Z' },
      { handle: 'other', searchedAt: '2026-07-10T01:00:00Z' },
    ]);
  });

  it('clears only the target handle history item', async () => {
    await recordTargetHandleSearch('alice', '2026-07-11T00:00:00Z');
    await clearTargetHandleHistory();
    await expect(targetHandleHistoryItem.getValue()).resolves.toEqual([]);
  });
});

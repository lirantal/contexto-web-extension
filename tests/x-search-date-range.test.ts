import { describe, expect, it } from 'vitest';
import { xSearchDateRange, type XSearchTimeframe } from '@/src/shared/x-search-date-range';

describe('X search date shortcuts', () => {
  it.each<[XSearchTimeframe, Date, string, string]>([
    ['30-days', new Date(2026, 0, 15, 0, 15), '2025-12-16', '2026-01-15'],
    ['90-days', new Date(2026, 0, 15, 23, 45), '2025-10-17', '2026-01-15'],
    ['30-days', new Date(2024, 2, 15), '2024-02-14', '2024-03-15'],
    ['12-months', new Date(2024, 1, 29), '2023-02-28', '2024-02-29'],
    ['12-months', new Date(2025, 1, 28), '2024-02-28', '2025-02-28'],
    ['12-months', new Date(2026, 9, 19), '2025-10-19', '2026-10-19'],
  ])('%s uses local calendar dates for %s', (timeframe, now, since, until) => {
    const originalTime = now.getTime();
    expect(xSearchDateRange(timeframe, now)).toEqual({ since, until });
    expect(now.getTime()).toBe(originalTime);
  });
});

export type XSearchTimeframe = '30-days' | '90-days' | '12-months';

function localDateString(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

export function xSearchDateRange(timeframe: XSearchTimeframe, now = new Date()): { since: string; until: string } {
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (timeframe === '12-months') {
    // Clamp February 29 to February 28 rather than overflowing into March.
    since.setFullYear(since.getFullYear() - 1, since.getMonth(), 1);
    const lastDay = new Date(since.getFullYear(), since.getMonth() + 1, 0).getDate();
    since.setDate(Math.min(now.getDate(), lastDay));
  } else {
    since.setDate(since.getDate() - (timeframe === '30-days' ? 30 : 90));
  }
  return { since: localDateString(since), until: localDateString(now) };
}

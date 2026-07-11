import { describe, expect, it } from 'vitest';
import { getAdjacentAccountId } from '@/src/ui/account-navigation';

describe('account keyboard navigation', () => {
  const accountIds = ['account-1', 'account-2', 'account-3'];

  it('moves through the current filtered account IDs', () => {
    expect(getAdjacentAccountId(accountIds, 'account-2', 1)).toBe('account-3');
    expect(getAdjacentAccountId(accountIds, 'account-2', -1)).toBe('account-1');
  });

  it('selects the first result when the previous selection is no longer filtered in', () => {
    expect(getAdjacentAccountId(accountIds, 'filtered-out', 1)).toBe('account-1');
  });

  it('stops at the first and last result', () => {
    expect(getAdjacentAccountId(accountIds, 'account-1', -1)).toBe('account-1');
    expect(getAdjacentAccountId(accountIds, 'account-3', 1)).toBe('account-3');
  });
});

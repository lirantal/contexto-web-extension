import { describe, expect, it } from 'vitest';
import {
  buildTargetHandleSuggestions,
  promoteTargetHandleHistory,
  type TargetAccountSuggestion,
} from '@/src/shared/target-handle-suggestions';

const accounts: TargetAccountSuggestion[] = [
  {
    id: 'account_alice',
    handle: 'alice_dev',
    displayName: 'Alice Example',
    companyName: 'Acme',
    updatedAt: '2026-07-10T10:00:00Z',
  },
  {
    id: 'account_bob',
    handle: 'bob_sec',
    displayName: 'Bob Builder',
    companyName: 'Secure Co',
    updatedAt: '2026-07-11T10:00:00Z',
  },
];

describe('target handle history', () => {
  it('normalizes a repeated handle and promotes it to the front', () => {
    const result = promoteTargetHandleHistory(
      [
        { handle: 'other', searchedAt: '2026-07-10T00:00:00Z' },
        { handle: 'Alice_Dev', searchedAt: '2026-07-01T00:00:00Z' },
      ],
      '@ALICE_DEV',
      '2026-07-11T00:00:00Z',
    );

    expect(result).toEqual([
      { handle: 'alice_dev', searchedAt: '2026-07-11T00:00:00Z' },
      { handle: 'other', searchedAt: '2026-07-10T00:00:00Z' },
    ]);
  });

  it('ignores empty handles and caps history at twenty entries', () => {
    const existing = Array.from({ length: 20 }, (_, index) => ({
      handle: `person_${index}`,
      searchedAt: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    expect(promoteTargetHandleHistory(existing, ' ', '2026-07-30T00:00:00Z')).toEqual(existing);
    const result = promoteTargetHandleHistory(existing, '@new_person', '2026-07-30T00:00:00Z');
    expect(result).toHaveLength(20);
    expect(result[0].handle).toBe('new_person');
    expect(result.at(-1)?.handle).toBe('person_18');
  });
});

describe('target handle suggestions', () => {
  it('merges duplicate history with account metadata and orders recents before saved accounts', () => {
    const result = buildTargetHandleSuggestions(accounts, [
      { handle: 'unknown', searchedAt: '2026-07-11T12:00:00Z' },
      { handle: 'ALICE_DEV', searchedAt: '2026-07-11T11:00:00Z' },
    ], '');

    expect(result.map(({ handle }) => handle)).toEqual(['unknown', 'alice_dev', 'bob_sec']);
    expect(result[1]).toMatchObject({
      id: 'account_alice',
      displayName: 'Alice Example',
      companyName: 'Acme',
      recent: true,
    });
  });

  it('matches and ranks handle before display name before company', () => {
    const candidates: TargetAccountSuggestion[] = [
      { id: 'company', handle: 'first', displayName: 'First', companyName: 'Alpha Labs', updatedAt: '2026-07-12' },
      { id: 'name', handle: 'second', displayName: 'Alpha Person', updatedAt: '2026-07-11' },
      { id: 'handle', handle: 'alpha_handle', displayName: 'Third', updatedAt: '2026-07-10' },
    ];

    expect(buildTargetHandleSuggestions(candidates, [], 'alpha').map(({ id, matchField }) => [id, matchField]))
      .toEqual([
        ['handle', 'handle'],
        ['name', 'displayName'],
        ['company', 'company'],
      ]);
  });

  it('matches history-only rows by handle and excludes unrelated text', () => {
    const history = [{ handle: 'recent_person', searchedAt: '2026-07-11T00:00:00Z' }];
    expect(buildTargetHandleSuggestions(accounts, history, 'recent')).toMatchObject([
      { handle: 'recent_person', source: 'history', matchField: 'handle' },
    ]);
    expect(buildTargetHandleSuggestions(accounts, history, 'conference note')).toEqual([]);
  });

  it('shows at most eight rows by default', () => {
    const manyAccounts = Array.from({ length: 10 }, (_, index) => ({
      id: `account_${index}`,
      handle: `person_${index}`,
      displayName: `Person ${index}`,
      updatedAt: `2026-07-${String(index + 1).padStart(2, '0')}`,
    }));

    expect(buildTargetHandleSuggestions(manyAccounts, [], '')).toHaveLength(8);
  });
});

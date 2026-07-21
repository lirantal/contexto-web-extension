import type { AccountSummary } from './types';

export function normalizeSidebarAccountSearchText(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function scoreCandidate(candidate: string, query: string): number | null {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;

  let cursor = 0;
  let first = -1;
  for (const character of query) {
    const index = candidate.indexOf(character, cursor);
    if (index === -1) return null;
    if (first === -1) first = index;
    cursor = index + 1;
  }

  return 3_000 + cursor - first;
}

export function searchSidebarAccounts(
  accounts: AccountSummary[],
  query: string,
  limit = 5,
): AccountSummary[] {
  const normalizedQuery = normalizeSidebarAccountSearchText(query);
  if (!normalizedQuery) return [];

  return accounts
    .filter((account) => account.platform === 'x')
    .map((account) => {
      const handle = normalizeSidebarAccountSearchText(account.normalizedHandle || account.handle);
      const name = normalizeSidebarAccountSearchText(account.displayName);
      const score = Math.min(
        scoreCandidate(handle, normalizedQuery) ?? Number.POSITIVE_INFINITY,
        scoreCandidate(name, normalizedQuery) ?? Number.POSITIVE_INFINITY,
      );

      return { account, score };
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score
      || left.account.displayName.localeCompare(right.account.displayName)
      || left.account.normalizedHandle.localeCompare(right.account.normalizedHandle))
    .slice(0, limit)
    .map(({ account }) => account);
}

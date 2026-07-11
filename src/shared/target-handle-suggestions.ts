import { normalizeXHandle } from './platforms/x';

export interface TargetHandleHistoryEntry {
  handle: string;
  searchedAt: string;
}

export interface TargetAccountSuggestion {
  id: string;
  handle: string;
  displayName: string;
  companyName?: string;
  updatedAt: string;
}

export interface TargetHandleSuggestion {
  id?: string;
  handle: string;
  displayName?: string;
  companyName?: string;
  updatedAt?: string;
  source: 'account' | 'history';
  recent: boolean;
  searchedAt?: string;
  matchField?: 'handle' | 'displayName' | 'company';
}

export const TARGET_HANDLE_HISTORY_LIMIT = 20;
export const TARGET_HANDLE_SUGGESTION_LIMIT = 8;

export function promoteTargetHandleHistory(
  entries: TargetHandleHistoryEntry[],
  handle: string,
  searchedAt: string,
): TargetHandleHistoryEntry[] {
  const normalizedHandle = normalizeXHandle(handle);
  if (!normalizedHandle) return entries;

  return [
    { handle: normalizedHandle, searchedAt },
    ...entries.filter((entry) => normalizeXHandle(entry.handle) !== normalizedHandle),
  ].slice(0, TARGET_HANDLE_HISTORY_LIMIT);
}

function timestamp(value?: string): number {
  return value ? Date.parse(value) || 0 : 0;
}

function recency(suggestion: TargetHandleSuggestion): number {
  return timestamp(suggestion.searchedAt ?? suggestion.updatedAt);
}

export function buildTargetHandleSuggestions(
  accounts: TargetAccountSuggestion[],
  history: TargetHandleHistoryEntry[],
  query: string,
  limit = TARGET_HANDLE_SUGGESTION_LIMIT,
): TargetHandleSuggestion[] {
  const suggestions = new Map<string, TargetHandleSuggestion>();

  for (const account of accounts) {
    const handle = normalizeXHandle(account.handle);
    if (!handle) continue;
    suggestions.set(handle, {
      ...account,
      handle,
      source: 'account',
      recent: false,
    });
  }

  for (const entry of history) {
    const handle = normalizeXHandle(entry.handle);
    if (!handle) continue;
    const account = suggestions.get(handle);
    suggestions.set(handle, account
      ? { ...account, recent: true, searchedAt: entry.searchedAt }
      : { handle, source: 'history', recent: true, searchedAt: entry.searchedAt });
  }

  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return [...suggestions.values()]
      .sort((left, right) => {
        if (left.recent !== right.recent) return left.recent ? -1 : 1;
        return recency(right) - recency(left);
      })
      .slice(0, limit);
  }

  const handleQuery = normalizeXHandle(trimmedQuery);
  return [...suggestions.values()]
    .map((suggestion) => {
      let matchField: TargetHandleSuggestion['matchField'];
      if (suggestion.handle.includes(handleQuery)) matchField = 'handle';
      else if (suggestion.displayName?.toLowerCase().includes(trimmedQuery)) matchField = 'displayName';
      else if (suggestion.companyName?.toLowerCase().includes(trimmedQuery)) matchField = 'company';
      return matchField ? { ...suggestion, matchField } : undefined;
    })
    .filter((suggestion): suggestion is TargetHandleSuggestion => Boolean(suggestion))
    .sort((left, right) => {
      const matchOrder = { handle: 0, displayName: 1, company: 2 } as const;
      const score = matchOrder[left.matchField!] - matchOrder[right.matchField!];
      return score || recency(right) - recency(left);
    })
    .slice(0, limit);
}

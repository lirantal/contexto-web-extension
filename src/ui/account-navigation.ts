export function getAdjacentAccountId(
  accountIds: string[],
  selectedId: string | undefined,
  offset: -1 | 1,
): string | undefined {
  if (accountIds.length === 0) return undefined;

  const selectedIndex = accountIds.indexOf(selectedId ?? '');
  if (selectedIndex === -1) return accountIds[0];

  return accountIds[Math.min(accountIds.length - 1, Math.max(0, selectedIndex + offset))];
}

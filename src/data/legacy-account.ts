/** Keep the original fields as well as a useful role; never destroy ambiguous legacy data. */
export function preserveLegacyAccountFields(account: Record<string, unknown>): void {
  if (typeof account.role === 'string' && account.role.trim()) return;
  const values = [account.position, account.profession]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map((value) => value.trim());
  if (values.length) account.role = [...new Set(values)].join(' · ');
}

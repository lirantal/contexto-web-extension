import { useEffect, useMemo, useState } from 'react';
import { searchSidebarAccounts } from '@/src/shared/sidebar-account-search';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { AccountSummary } from '@/src/shared/types';

type Send = (message: ContextoRequest) => Promise<ContextoResponse>;

export function ContextoSidebarAccountSearch({
  send,
  navigate = (url) => window.location.assign(url),
}: { send: Send; navigate?: (url: string) => void }) {
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void send({ type: 'contexto:account:list' }).then((response) => {
      if (!active) return;
      if (response.ok && 'accounts' in response) setAccounts(response.accounts);
      else setError(true);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [send]);

  const results = useMemo(() => accounts ? searchSidebarAccounts(accounts, query) : [], [accounts, query]);

  return <section className="contexto-sidebar-search" aria-label="Contexto account search">
    <label htmlFor="contexto-sidebar-account-query">Search Contexto accounts</label>
    <input
      id="contexto-sidebar-account-query"
      value={query}
      disabled={!accounts || error}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Name or @handle"
    />
    {!error && !accounts && <p role="status">Loading saved accounts…</p>}
    {error && <p role="status">Contexto accounts are unavailable.</p>}
    {!error && accounts && query && results.length === 0 && <p role="status">No saved accounts found.</p>}
    {results.length > 0 && <div className="contexto-sidebar-search-results">{results.map((account) =>
      <button key={account.id} type="button"
        onClick={() => navigate(account.profileUrl || `https://x.com/${account.normalizedHandle}`)}>
        {account.displayName} @{account.handle}
      </button>)}</div>}
  </section>;
}

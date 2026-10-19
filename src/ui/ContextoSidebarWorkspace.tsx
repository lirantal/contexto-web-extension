import React from 'react';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import { createQuickXSearchPersistence } from '@/src/shared/quick-x-search-persistence';
import type { XSearchFilters } from '@/src/shared/types';
import { ContextoSidebarAccountSearch } from '@/src/ui/ContextoSidebarAccountSearch';
import { QuickXSearch } from '@/src/ui/QuickXSearch';

type Send = (message: ContextoRequest) => Promise<ContextoResponse>;

export function ContextoSidebarWorkspace({
  send,
}: { send: Send }): React.JSX.Element {
  const persistence = React.useMemo(() => createQuickXSearchPersistence(send), [send]);

  const loadAccountSuggestions = React.useCallback(async () => {
    const response = await send({ type: 'contexto:account:list' });
    if (!response.ok || !('accounts' in response)) {
      throw new Error(response.ok ? 'Account suggestions unavailable' : response.error);
    }

    return response.accounts
      .filter((account) => account.platform === 'x')
      .map((account) => ({
        id: account.id,
        handle: account.handle,
        displayName: account.displayName,
        companyName: account.company?.name,
        updatedAt: account.updatedAt,
      }));
  }, [send]);

  const launchSearch = React.useCallback(async (filters: XSearchFilters) => {
    const response = await send({ type: 'contexto:search:open', filters });
    if (!response.ok) throw new Error(response.error);
  }, [send]);

  return (
    <div className="contexto-sidebar-workspace">
      <ContextoSidebarAccountSearch send={send} />
      <section aria-label="Quick X search">
        <QuickXSearch
          surface="sidebar"
          loadAccountSuggestions={loadAccountSuggestions}
          launchSearch={launchSearch}
          persistence={persistence}
        />
      </section>
    </div>
  );
}

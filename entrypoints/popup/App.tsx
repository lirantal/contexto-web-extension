import React from 'react';
import { browser } from 'wxt/browser';
import { ExternalLink, Settings, Users } from 'lucide-react';
import { listTargetAccountSuggestions } from '@/src/data/repositories';
import type { ContextoResponse } from '@/src/shared/messages';
import { buildXSearchUrl } from '@/src/shared/platforms/x';
import { createQuickXSearchPersistence } from '@/src/shared/quick-x-search-persistence';
import { QuickXSearch } from '@/src/ui/QuickXSearch';
import '@/src/ui/quick-x-search.css';
import './App.css';

const quickXSearchPersistence = createQuickXSearchPersistence(
  (message) => browser.runtime.sendMessage(message) as Promise<ContextoResponse>,
);

function App() {
  async function openDashboard() {
    await browser.runtime.openOptionsPage();
  }

  return (
    <main className="popup-shell">
      <header>
        <span className="brand-mark">C</span>
        <div>
          <h1>Contexto</h1>
          <p>Quick X search</p>
        </div>
      </header>

      <QuickXSearch
        surface="popup"
        loadAccountSuggestions={listTargetAccountSuggestions}
        launchSearch={(filters) => browser.tabs.create({ url: buildXSearchUrl(filters) }).then(() => undefined)}
        persistence={quickXSearchPersistence}
      />

      <footer>
        <button onClick={openDashboard}><Users size={15} aria-hidden="true" /> Dashboard</button>
        <a href="https://x.com" target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /> X</a>
        <button onClick={openDashboard}><Settings size={15} aria-hidden="true" /> Settings</button>
      </footer>
    </main>
  );
}

export default App;

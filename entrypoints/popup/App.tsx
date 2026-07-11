import { useEffect, useState } from 'react';
import { ExternalLink, Search, Settings, Users } from 'lucide-react';
import { buildXSearchQuery, buildXSearchUrl, canRunXSearch, normalizeXHandle } from '@/src/shared/platforms/x';
import {
  defaultPopupSearchState,
  defaultSettings,
  popupSearchStateItem,
  settingsItem,
} from '@/src/shared/settings';
import type {
  ContextoSettings,
  PopupSearchState,
  SearchDirection,
  XSearchFilters,
} from '@/src/shared/types';
import './App.css';

const actions: Array<{ direction: SearchDirection; label: string }> = [
  { direction: 'me-to-them', label: 'Posts by me' },
  { direction: 'them-to-me', label: 'Posts to me' },
  { direction: 'from-profile', label: 'Posts by other person' },
  { direction: 'mentions', label: 'Mentions of other person' },
];

function App() {
  const [settings, setSettings] = useState<ContextoSettings>(defaultSettings);
  const [searchState, setSearchState] = useState<PopupSearchState>(defaultPopupSearchState);

  useEffect(() => {
    let active = true;

    Promise.all([settingsItem.getValue(), popupSearchStateItem.getValue()]).then(([savedSettings, savedSearch]) => {
      if (!active) return;
      setSettings(savedSettings);
      setSearchState(savedSearch);
    });

    return () => {
      active = false;
    };
  }, []);

  async function openDashboard() {
    await browser.runtime.openOptionsPage();
  }

  async function updateMyHandle(value: string) {
    const next = { ...settings, myXHandle: value };
    setSettings(next);
    await settingsItem.setValue(next);
  }

  function updateSearchField<Key extends keyof PopupSearchState>(field: Key, value: PopupSearchState[Key]) {
    const next = { ...searchState, [field]: value };
    setSearchState(next);
    void popupSearchStateItem.setValue(next);
  }

  function filtersFor(direction: SearchDirection): XSearchFilters {
    return {
      viewerHandle: settings.myXHandle,
      targetHandle: normalizeXHandle(searchState.targetHandle),
      keyword: searchState.keyword,
      since: searchState.since,
      until: searchState.until,
      direction,
    };
  }

  async function openSearch(direction: SearchDirection) {
    const filters = filtersFor(direction);
    if (!canRunXSearch(filters)) return;

    await Promise.all([
      settingsItem.setValue(settings),
      popupSearchStateItem.setValue(searchState),
    ]);
    await browser.tabs.create({ url: buildXSearchUrl(filters) });
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

      <section className="popup-section search-fields">
        <label>
          My X handle
          <input
            aria-label="My X handle"
            value={settings.myXHandle}
            onChange={(event) => updateMyHandle(event.target.value)}
            placeholder="@your_handle"
          />
          <small>Used by “Posts by me” and “Posts to me.”</small>
        </label>
        <label>
          Other person's X handle <span className="optional-label">Optional</span>
          <input
            aria-label="Other person's X handle"
            value={searchState.targetHandle}
            onChange={(event) => updateSearchField('targetHandle', event.target.value)}
            placeholder="@their_handle"
          />
          <small>Narrows the first two actions; required by the last two.</small>
        </label>
        <label>
          Keyword
          <input
            aria-label="Keyword"
            value={searchState.keyword}
            onChange={(event) => updateSearchField('keyword', event.target.value)}
            placeholder="Optional keyword"
          />
        </label>
        <div className="date-row">
          <label>
            Since
            <input
              aria-label="Since"
              type="date"
              value={searchState.since}
              onChange={(event) => updateSearchField('since', event.target.value)}
            />
          </label>
          <label>
            Until
            <input
              aria-label="Until"
              type="date"
              value={searchState.until}
              onChange={(event) => updateSearchField('until', event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="popup-section action-grid" aria-labelledby="search-actions-heading">
        <div className="action-heading">
          <h2 id="search-actions-heading">Choose what to search</h2>
          <p>Each button previews the X query it will run.</p>
        </div>
        {actions.map(({ direction, label }) => {
          const filters = filtersFor(direction);
          const enabled = canRunXSearch(filters);
          const missingHandle = direction === 'me-to-them' || direction === 'them-to-me'
            ? 'Enter your X handle'
            : 'Enter the other person’s handle';
          const preview = enabled ? buildXSearchQuery(filters) : missingHandle;

          return (
            <button
              className="search-action"
              key={direction}
              onClick={() => openSearch(direction)}
              disabled={!enabled}
              title={preview}
            >
              <Search size={16} aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{preview}</small>
              </span>
            </button>
          );
        })}
      </section>

      <footer>
        <button onClick={openDashboard}><Users size={15} aria-hidden="true" /> Dashboard</button>
        <a href="https://x.com" target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /> X</a>
        <button onClick={openDashboard}><Settings size={15} aria-hidden="true" /> Settings</button>
      </footer>
    </main>
  );
}

export default App;

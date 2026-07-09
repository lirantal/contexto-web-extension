import { useEffect, useState } from 'react';
import { ExternalLink, Search, Settings, Users } from 'lucide-react';
import { buildXSearchUrl, labelSearchDirection, normalizeXHandle } from '@/src/shared/platforms/x';
import { defaultSettings, settingsItem } from '@/src/shared/settings';
import type { ContextoSettings, SearchDirection, XSearchFilters } from '@/src/shared/types';
import './App.css';

const directions: SearchDirection[] = ['me-to-them', 'them-to-me', 'from-profile', 'mentions'];

function App() {
  const [settings, setSettings] = useState<ContextoSettings>(defaultSettings);
  const [targetHandle, setTargetHandle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');

  useEffect(() => {
    settingsItem.getValue().then(setSettings);
  }, []);

  async function openDashboard() {
    await browser.runtime.openOptionsPage();
  }

  async function updateMyHandle(value: string) {
    const next = { ...settings, myXHandle: value };
    setSettings(next);
    await settingsItem.setValue(next);
  }

  async function openSearch(direction: SearchDirection) {
    const filters: XSearchFilters = {
      viewerHandle: settings.myXHandle,
      targetHandle: normalizeXHandle(targetHandle),
      keyword,
      since,
      until,
      direction,
    };
    const url = buildXSearchUrl(filters);
    await browser.tabs.create({ url });
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

      <section className="popup-section">
        <label>My X handle<input value={settings.myXHandle} onChange={(event) => updateMyHandle(event.target.value)} placeholder="@your_handle" /></label>
        <label>Target handle<input value={targetHandle} onChange={(event) => setTargetHandle(event.target.value)} placeholder="@their_handle" /></label>
        <label>Keyword<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Optional keyword" /></label>
        <div className="date-row">
          <label>Since<input type="date" value={since} onChange={(event) => setSince(event.target.value)} /></label>
          <label>Until<input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
        </div>
      </section>

      <section className="popup-section action-grid">
        {directions.map((direction) => (
          <button key={direction} onClick={() => openSearch(direction)} disabled={!targetHandle.trim()}>
            <Search size={15} aria-hidden="true" /> {labelSearchDirection(direction)}
          </button>
        ))}
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

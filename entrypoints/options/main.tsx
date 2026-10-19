import React from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import type { ContextoResponse } from '@/src/shared/messages';
import { createContextoSettingsPersistence } from '@/src/shared/quick-x-search-persistence';
import { Dashboard } from '@/src/ui/Dashboard';
import './style.css';
import '@/src/ui/fuzzy-text-combobox.css';

const settingsPersistence = createContextoSettingsPersistence(
  (message) => browser.runtime.sendMessage(message) as Promise<ContextoResponse>,
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Dashboard settingsPersistence={settingsPersistence} />
  </React.StrictMode>,
);

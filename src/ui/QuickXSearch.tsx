import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  buildXSearchQuery,
  canRunXSearch,
  normalizeXHandle,
} from '@/src/shared/platforms/x';
import {
  defaultPopupSearchState,
  defaultSettings,
  popupSearchStateItem,
  recordTargetHandleSearch,
  settingsItem,
  targetHandleHistoryItem,
} from '@/src/shared/settings';
import type {
  ContextoSettings,
  PopupSearchState,
  SearchDirection,
  XSearchFilters,
} from '@/src/shared/types';
import {
  buildTargetHandleSuggestions,
  type TargetAccountSuggestion,
  type TargetHandleHistoryEntry,
} from '@/src/shared/target-handle-suggestions';
import { TargetHandleCombobox } from '@/src/ui/TargetHandleCombobox';

export interface QuickXSearchProps {
  loadAccountSuggestions: () => Promise<TargetAccountSuggestion[]>;
  launchSearch: (filters: XSearchFilters) => Promise<void>;
  surface: 'popup' | 'sidebar';
}

const actions: Array<{ direction: SearchDirection; label: string }> = [
  { direction: 'me-to-them', label: 'Posts by me' },
  { direction: 'them-to-me', label: 'Posts to me' },
  { direction: 'from-profile', label: 'Posts by other person' },
  { direction: 'mentions', label: 'Mentions of other person' },
];

export function QuickXSearch({ loadAccountSuggestions, launchSearch, surface }: QuickXSearchProps): React.JSX.Element {
  const [settings, setSettings] = useState<ContextoSettings>(defaultSettings);
  const [searchState, setSearchState] = useState<PopupSearchState>(defaultPopupSearchState);
  const [accountSuggestions, setAccountSuggestions] = useState<TargetAccountSuggestion[]>([]);
  const [targetHistory, setTargetHistory] = useState<TargetHandleHistoryEntry[]>([]);

  useEffect(() => {
    let active = true;

    void Promise.allSettled([
      settingsItem.getValue(),
      popupSearchStateItem.getValue(),
      loadAccountSuggestions(),
      targetHandleHistoryItem.getValue(),
    ]).then(([settingsResult, searchResult, accountResult, historyResult]) => {
      if (!active) return;
      if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
      if (searchResult.status === 'fulfilled') setSearchState(searchResult.value);
      if (accountResult.status === 'fulfilled') setAccountSuggestions(accountResult.value);
      if (historyResult.status === 'fulfilled') setTargetHistory(historyResult.value);
    });

    const unwatchSettings = settingsItem.watch((value) => {
      if (active) setSettings(value);
    });
    const unwatchSearchState = popupSearchStateItem.watch((value) => {
      if (active) setSearchState(value);
    });
    const unwatchTargetHistory = targetHandleHistoryItem.watch((value) => {
      if (active) setTargetHistory(value);
    });

    return () => {
      active = false;
      unwatchSettings();
      unwatchSearchState();
      unwatchTargetHistory();
    };
  }, [loadAccountSuggestions]);

  const targetSuggestions = useMemo(
    () => buildTargetHandleSuggestions(accountSuggestions, targetHistory, searchState.targetHandle),
    [accountSuggestions, targetHistory, searchState.targetHandle],
  );

  function updateMyHandle(value: string) {
    const next = { ...settings, myXHandle: value };
    setSettings(next);
    void settingsItem.setValue(next);
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

    try {
      await Promise.all([
        settingsItem.setValue(settings),
        popupSearchStateItem.setValue(searchState),
      ]);
      await launchSearch(filters);
    } catch {
      return;
    }

    if (filters.targetHandle) {
      try {
        setTargetHistory(await recordTargetHandleSearch(filters.targetHandle));
      } catch {
        // Launch already succeeded; history remains best-effort.
      }
    }
  }

  return (
    <div className="contexto-quick-search" data-surface={surface}>
      <section className="quick-search-section search-fields">
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
          <TargetHandleCombobox
            value={searchState.targetHandle}
            suggestions={targetSuggestions}
            onChange={(value) => updateSearchField('targetHandle', value)}
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

      <section className="quick-search-section action-grid" aria-labelledby="search-actions-heading">
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
              onClick={() => void openSearch(direction)}
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
    </div>
  );
}

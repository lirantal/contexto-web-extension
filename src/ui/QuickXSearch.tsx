import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  settingsItem,
  targetHandleHistoryItem,
} from '@/src/shared/settings';
import type { QuickXSearchPersistence } from '@/src/shared/quick-x-search-persistence';
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
  persistence: QuickXSearchPersistence;
  surface: 'popup' | 'sidebar';
}

const actions: Array<{ direction: SearchDirection; label: string }> = [
  { direction: 'me-to-them', label: 'Posts by me' },
  { direction: 'them-to-me', label: 'Posts to me' },
  { direction: 'from-profile', label: 'Posts by other person' },
  { direction: 'mentions', label: 'Mentions of other person' },
];

interface DirtyField {
  value: unknown;
}

function reconcileWatchedValue<T extends object>(
  current: T,
  watched: T,
  dirtyFields: Map<keyof T, DirtyField[]>,
): T {
  const next = { ...watched };
  dirtyFields.forEach((pending, field) => {
    if (Object.is(watched[field], pending[0]?.value)) {
      pending.shift();
    }
    if (pending.length === 0) {
      dirtyFields.delete(field);
    } else {
      next[field] = current[field];
    }
  });
  return next;
}

function withUpdatedField<T extends object, Key extends keyof T>(
  current: T,
  field: Key,
  value: T[Key],
): T | undefined {
  if (Object.is(current[field], value)) return undefined;
  return { ...current, [field]: value };
}

function markDirtyField<T extends object>(
  dirtyFields: Map<keyof T, DirtyField[]>,
  field: keyof T,
  value: unknown,
): DirtyField {
  const dirty = { value };
  const pending = dirtyFields.get(field) ?? [];
  pending.push(dirty);
  dirtyFields.set(field, pending);
  return dirty;
}

function forgetDirtyField<T extends object>(
  dirtyFields: Map<keyof T, DirtyField[]>,
  field: keyof T,
  dirty: DirtyField,
): void {
  const pending = dirtyFields.get(field);
  if (!pending) return;

  const index = pending.indexOf(dirty);
  if (index >= 0) pending.splice(index, 1);
  if (pending.length === 0) dirtyFields.delete(field);
}

export function QuickXSearch({
  loadAccountSuggestions,
  launchSearch,
  persistence,
  surface,
}: QuickXSearchProps): React.JSX.Element {
  const [settings, setSettings] = useState<ContextoSettings>(defaultSettings);
  const [searchState, setSearchState] = useState<PopupSearchState>(defaultPopupSearchState);
  const [accountSuggestions, setAccountSuggestions] = useState<TargetAccountSuggestion[]>([]);
  const [targetHistory, setTargetHistory] = useState<TargetHandleHistoryEntry[]>([]);
  const [settingsReady, setSettingsReady] = useState(false);
  const [searchStateReady, setSearchStateReady] = useState(false);
  const settingsVersion = useRef(0);
  const searchStateVersion = useRef(0);
  const targetHistoryVersion = useRef(0);
  const latestSettings = useRef(defaultSettings);
  const latestSearchState = useRef(defaultPopupSearchState);
  const dirtySettings = useRef(new Map<keyof ContextoSettings, DirtyField[]>());
  const dirtySearchState = useRef(new Map<keyof PopupSearchState, DirtyField[]>());

  const pendingSettingsWrite = useRef<Promise<ContextoSettings> | undefined>(undefined);
  const pendingSearchStateWrite = useRef<Promise<PopupSearchState> | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const initialSettingsVersion = settingsVersion.current;
    const initialSearchStateVersion = searchStateVersion.current;
    const initialTargetHistoryVersion = targetHistoryVersion.current;

    void Promise.allSettled([settingsItem.getValue()]).then(([result]) => {
      if (!active) return;
      if (settingsVersion.current === initialSettingsVersion && result.status === 'fulfilled') {
        latestSettings.current = result.value;
        setSettings(result.value);
      }
      setSettingsReady(true);
    });
    void Promise.allSettled([popupSearchStateItem.getValue()]).then(([result]) => {
      if (!active) return;
      if (searchStateVersion.current === initialSearchStateVersion && result.status === 'fulfilled') {
        latestSearchState.current = result.value;
        setSearchState(result.value);
      }
      setSearchStateReady(true);
    });
    void Promise.allSettled([loadAccountSuggestions()]).then(([result]) => {
      if (active && result.status === 'fulfilled') {
        setAccountSuggestions(result.value);
      }
    });
    void Promise.allSettled([targetHandleHistoryItem.getValue()]).then(([result]) => {
      if (active && targetHistoryVersion.current === initialTargetHistoryVersion && result.status === 'fulfilled') {
        setTargetHistory(result.value);
      }
    });

    const unwatchSettings = settingsItem.watch((value) => {
      if (active) {
        settingsVersion.current += 1;
        const next = reconcileWatchedValue(
          latestSettings.current,
          value,
          dirtySettings.current,
        );
        latestSettings.current = next;
        setSettings(next);
      }
    });
    const unwatchSearchState = popupSearchStateItem.watch((value) => {
      if (active) {
        searchStateVersion.current += 1;
        const next = reconcileWatchedValue(
          latestSearchState.current,
          value,
          dirtySearchState.current,
        );
        latestSearchState.current = next;
        setSearchState(next);
      }
    });
    const unwatchTargetHistory = targetHandleHistoryItem.watch((value) => {
      if (active) {
        targetHistoryVersion.current += 1;
        setTargetHistory(value);
      }
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
    const next = withUpdatedField(latestSettings.current, 'myXHandle', value);
    if (!next) return;

    settingsVersion.current += 1;
    const dirty = markDirtyField(dirtySettings.current, 'myXHandle', value);
    latestSettings.current = next;
    setSettings(next);
    const write = persistence.updateSettings({ myXHandle: value });
    pendingSettingsWrite.current = write;
    void write.catch(() => {
      forgetDirtyField(dirtySettings.current, 'myXHandle', dirty);
    });
  }

  function updateSearchField<Key extends keyof PopupSearchState>(field: Key, value: PopupSearchState[Key]) {
    const next = withUpdatedField(latestSearchState.current, field, value);
    if (!next) return;

    searchStateVersion.current += 1;
    const dirty = markDirtyField(dirtySearchState.current, field, value);
    latestSearchState.current = next;
    setSearchState(next);
    const write = persistence.updateSearchState({ [field]: value });
    pendingSearchStateWrite.current = write;
    void write.catch(() => {
      forgetDirtyField(dirtySearchState.current, field, dirty);
    });
  }

  function filtersFor(
    direction: SearchDirection,
    currentSettings = settings,
    currentSearchState = searchState,
  ): XSearchFilters {
    return {
      viewerHandle: currentSettings.myXHandle,
      targetHandle: normalizeXHandle(currentSearchState.targetHandle),
      keyword: currentSearchState.keyword,
      since: currentSearchState.since,
      until: currentSearchState.until,
      direction,
    };
  }

  async function waitForStableWrites(): Promise<boolean> {
    while (true) {
      const settingsWrite = pendingSettingsWrite.current;
      const searchStateWrite = pendingSearchStateWrite.current;

      try {
        await Promise.all([settingsWrite, searchStateWrite]);
      } catch {
        return false;
      }

      if (
        settingsWrite === pendingSettingsWrite.current
        && searchStateWrite === pendingSearchStateWrite.current
      ) {
        return true;
      }
    }
  }

  async function openSearch(direction: SearchDirection) {
    if (!settingsReady || !searchStateReady) return;

    if (!await waitForStableWrites()) return;

    const filters = filtersFor(
      direction,
      latestSettings.current,
      latestSearchState.current,
    );
    if (!canRunXSearch(filters)) return;

    try {
      await launchSearch(filters);
    } catch {
      return;
    }

    if (filters.targetHandle) {
      try {
        targetHistoryVersion.current += 1;
        setTargetHistory(await persistence.promoteTargetHandle(filters.targetHandle));
      } catch {
        // Launch already succeeded; history remains best-effort.
      }
    }
  }

  return (
    <div className="contexto-quick-search" data-surface={surface}>
      <section
        className="quick-search-section search-fields"
        role="group"
        aria-labelledby="people-heading"
      >
        <h2 id="people-heading">People</h2>
        <label>
          My X handle
          <input
            disabled={!settingsReady}
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
            disabled={!searchStateReady}
            suggestions={targetSuggestions}
            onChange={(value) => updateSearchField('targetHandle', value)}
          />
          <small>Narrows the first two actions; required by the last two.</small>
        </label>
      </section>

      <section
        className="quick-search-section search-fields"
        role="group"
        aria-labelledby="filters-heading"
      >
        <h2 id="filters-heading">Filters</h2>
        <label>
          Keyword
          <input
            disabled={!searchStateReady}
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
              disabled={!searchStateReady}
              value={searchState.since}
              onChange={(event) => updateSearchField('since', event.target.value)}
            />
          </label>
          <label>
            Until
            <input
              aria-label="Until"
              type="date"
              disabled={!searchStateReady}
              value={searchState.until}
              onChange={(event) => updateSearchField('until', event.target.value)}
            />
          </label>
        </div>
      </section>

      <section
        className="quick-search-section action-grid"
        role="group"
        aria-labelledby="search-actions-heading"
      >
        <div className="action-heading">
          <h2 id="search-actions-heading">Choose what to search</h2>
          <p>Each button previews the X query it will run.</p>
        </div>
        {actions.map(({ direction, label }) => {
          const filters = filtersFor(direction);
          const enabled = settingsReady && searchStateReady && canRunXSearch(filters);
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

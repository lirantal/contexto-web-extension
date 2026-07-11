import { storage } from 'wxt/utils/storage';
import type { ContextoSettings, PopupSearchState } from './types';
import {
  promoteTargetHandleHistory,
  type TargetHandleHistoryEntry,
} from './target-handle-suggestions';

export const defaultSettings: ContextoSettings = {
  myXHandle: '',
  lastDashboardView: 'accounts',
};

export const settingsItem = storage.defineItem<ContextoSettings>('local:contexto-settings', {
  fallback: defaultSettings,
});

export const defaultPopupSearchState: PopupSearchState = {
  targetHandle: '',
  keyword: '',
  since: '',
  until: '',
};

export const popupSearchStateItem = storage.defineItem<PopupSearchState>('local:contexto-popup-search', {
  fallback: defaultPopupSearchState,
});

export const targetHandleHistoryItem = storage.defineItem<TargetHandleHistoryEntry[]>(
  'local:contexto-target-handle-history',
  { fallback: [] },
);

export async function recordTargetHandleSearch(
  handle: string,
  searchedAt = new Date().toISOString(),
): Promise<TargetHandleHistoryEntry[]> {
  const current = await targetHandleHistoryItem.getValue();
  const next = promoteTargetHandleHistory(current, handle, searchedAt);
  await targetHandleHistoryItem.setValue(next);
  return next;
}

export async function clearTargetHandleHistory(): Promise<void> {
  await targetHandleHistoryItem.setValue([]);
}

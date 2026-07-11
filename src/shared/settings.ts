import { storage } from 'wxt/utils/storage';
import type { ContextoSettings, PopupSearchState } from './types';

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

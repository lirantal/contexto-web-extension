import { storage } from 'wxt/utils/storage';
import type { ContextoSettings } from './types';

export const defaultSettings: ContextoSettings = {
  myXHandle: '',
  lastDashboardView: 'accounts',
};

export const settingsItem = storage.defineItem<ContextoSettings>('local:contexto-settings', {
  fallback: defaultSettings,
});

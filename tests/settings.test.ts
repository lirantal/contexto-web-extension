import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeContextoSettings } from '@/src/shared/settings';

describe('Contexto settings', () => {
  it('hides native X sidebar widgets by default', () => {
    expect(defaultSettings.showNativeXSidebarWidgets).toBe(false);
  });

  it('fills the default for settings saved before sidebar controls existed', () => {
    expect(normalizeContextoSettings({
      myXHandle: '@me',
      lastDashboardView: 'accounts',
    })).toEqual({
      myXHandle: '@me',
      lastDashboardView: 'accounts',
      showNativeXSidebarWidgets: false,
    });
  });
});

import type { ContextoRequest, ContextoResponse } from './messages';
import type { ContextoSettings, PopupSearchState } from './types';
import type { TargetHandleHistoryEntry } from './target-handle-suggestions';

type Send = (message: ContextoRequest) => Promise<ContextoResponse>;

export interface ContextoSettingsPersistence {
  updateSettings(patch: Partial<ContextoSettings>): Promise<ContextoSettings>;
}

export interface QuickXSearchPersistence {
  updateSettings(patch: Pick<ContextoSettings, 'myXHandle'>): Promise<ContextoSettings>;
  updateSearchState(patch: Partial<PopupSearchState>): Promise<PopupSearchState>;
  promoteTargetHandle(handle: string): Promise<TargetHandleHistoryEntry[]>;
}

function responseError(response: ContextoResponse, fallback: string): Error {
  return new Error(response.ok ? fallback : response.error);
}

export function createContextoSettingsPersistence(send: Send): ContextoSettingsPersistence {
  return {
    async updateSettings(patch) {
      const response = await send({ type: 'contexto:settings:update', patch });
      if (!response.ok || !('settings' in response)) {
        throw responseError(response, 'Settings unavailable');
      }
      return response.settings;
    },
  };
}

export function createQuickXSearchPersistence(send: Send): QuickXSearchPersistence {
  const settingsPersistence = createContextoSettingsPersistence(send);

  return {
    updateSettings: settingsPersistence.updateSettings,

    async updateSearchState(patch) {
      const response = await send({ type: 'contexto:search-state:update', patch });
      if (!response.ok || !('searchState' in response)) {
        throw responseError(response, 'Search state unavailable');
      }
      return response.searchState;
    },

    async promoteTargetHandle(handle) {
      const response = await send({ type: 'contexto:target-history:promote', handle });
      if (!response.ok || !('targetHandleHistory' in response)) {
        throw responseError(response, 'Target history unavailable');
      }
      return response.targetHandleHistory;
    },
  };
}

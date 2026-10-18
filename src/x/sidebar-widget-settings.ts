import { normalizeContextoSettings } from '@/src/shared/settings';
import type { ContextoSettings } from '@/src/shared/types';

interface WatchXSidebarWidgetSettingOptions {
  getSettings: () => Promise<Partial<ContextoSettings>>;
  watchSettings: (
    callback: (value: Partial<ContextoSettings>) => void,
  ) => () => void;
  setShowNativeWidgets: (show: boolean) => void;
}

export function watchXSidebarWidgetSetting({
  getSettings,
  watchSettings,
  setShowNativeWidgets,
}: WatchXSidebarWidgetSettingOptions): () => void {
  let active = true;
  let liveRevision = 0;
  const unwatch = watchSettings((value) => {
    if (!active) return;
    liveRevision += 1;
    setShowNativeWidgets(normalizeContextoSettings(value).showNativeXSidebarWidgets);
  });
  const startupRevision = liveRevision;

  void getSettings().then((value) => {
    if (!active || liveRevision !== startupRevision) return;
    setShowNativeWidgets(normalizeContextoSettings(value).showNativeXSidebarWidgets);
  }).catch(() => {
    if (!active || liveRevision !== startupRevision) return;
    setShowNativeWidgets(false);
  });

  return () => {
    active = false;
    unwatch();
  };
}

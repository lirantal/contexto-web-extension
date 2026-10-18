import { describe, expect, it, vi } from 'vitest';
import { watchXSidebarWidgetSetting } from '@/src/x/sidebar-widget-settings';

describe('X sidebar widget setting binding', () => {
  it('normalizes legacy startup settings and applies live changes until stopped', async () => {
    let watcher: ((value: { showNativeXSidebarWidgets?: boolean }) => void) | undefined;
    const unwatch = vi.fn();
    const setShowNativeWidgets = vi.fn();
    const stop = watchXSidebarWidgetSetting({
      getSettings: vi.fn().mockResolvedValue({
        myXHandle: '@me',
        lastDashboardView: 'accounts',
      }),
      watchSettings: (callback) => {
        watcher = callback;
        return unwatch;
      },
      setShowNativeWidgets,
    });

    await vi.waitFor(() => expect(setShowNativeWidgets).toHaveBeenCalledWith(false));
    watcher?.({ showNativeXSidebarWidgets: true });
    expect(setShowNativeWidgets).toHaveBeenLastCalledWith(true);

    stop();
    expect(unwatch).toHaveBeenCalledOnce();
    watcher?.({ showNativeXSidebarWidgets: false });
    expect(setShowNativeWidgets).toHaveBeenCalledTimes(2);
  });

  it('keeps the default-hidden policy when the startup read fails', async () => {
    const setShowNativeWidgets = vi.fn();
    watchXSidebarWidgetSetting({
      getSettings: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      watchSettings: vi.fn(() => vi.fn()),
      setShowNativeWidgets,
    });

    await vi.waitFor(() => expect(setShowNativeWidgets).toHaveBeenCalledWith(false));
  });
});

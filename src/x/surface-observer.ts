import { extractFullProfile, extractHoverCardProfile, type XSurfaceKind } from './extract-profile';
import type { ProfileSnapshot } from '@/src/shared/types';

export interface ObservedXSurface {
  kind: XSurfaceKind;
  host: HTMLElement;
  profile: ProfileSnapshot;
}

export interface XSurfaceObserverOptions {
  root: HTMLElement;
  currentUrl: () => string;
  mount: (surface: ObservedXSurface) => () => void;
}

export function createXSurfaceObserver(options: XSurfaceObserverOptions) {
  const mounted = new Map<HTMLElement, () => void>();
  let queued = false;

  const mount = (host: HTMLElement, kind: XSurfaceKind, profile: ProfileSnapshot | null) => {
    if (!profile || mounted.has(host)) return;
    mounted.set(host, options.mount({ kind, host, profile }));
  };

  const scan = () => {
    queued = false;
    for (const [host, cleanup] of mounted) {
      if (!host.isConnected) {
        cleanup();
        mounted.delete(host);
      }
    }

    for (const host of options.root.querySelectorAll<HTMLElement>('[role="dialog"][data-testid="HoverCard"]')) {
      mount(host, 'hover-card', extractHoverCardProfile(host));
    }

    const profileHost = options.root.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
    if (profileHost) mount(profileHost, 'full-profile', extractFullProfile(profileHost, options.currentUrl()));
  };

  const queueScan = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };

  const observer = new MutationObserver(queueScan);
  observer.observe(options.root, { childList: true, subtree: true });
  queueScan();

  return {
    disconnect() {
      observer.disconnect();
      for (const cleanup of mounted.values()) cleanup();
      mounted.clear();
    },
  };
}

import { extractFullProfile, extractHoverCardProfile, type XSurfaceKind } from './extract-profile';
import type { ProfileSnapshot } from '@/src/shared/types';

export interface ObservedXSurface {
  kind: XSurfaceKind;
  host: HTMLElement;
  profile: ProfileSnapshot;
}

export type XSurfaceCleanup = (() => void) & { isConnected?: () => boolean };

export interface XSurfaceObserverOptions {
  root: HTMLElement;
  currentUrl: () => string;
  onPageContextChange?: () => void;
  mount: (surface: ObservedXSurface) => XSurfaceCleanup;
}

export function createXSurfaceObserver(options: XSurfaceObserverOptions) {
  const mounted = new Map<HTMLElement, { identity: string; cleanup: XSurfaceCleanup }>();
  let queued = false;
  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  let previousUrl = options.currentUrl();

  const mount = (host: HTMLElement, kind: XSurfaceKind, profile: ProfileSnapshot | null) => {
    if (!profile) return;
    const identity = `${kind}:${profile.handle.toLowerCase()}:${profile.profileUrl}`;
    const current = mounted.get(host);
    if (current?.identity === identity && (current.cleanup.isConnected?.() ?? true)) return;
    current?.cleanup();
    mounted.set(host, { identity, cleanup: options.mount({ kind, host, profile }) });
  };

  const scan = () => {
    queued = false;
    const currentUrl = options.currentUrl();
    if (currentUrl !== previousUrl) {
      previousUrl = currentUrl;
      options.onPageContextChange?.();
    }
    for (const [host, entry] of mounted) {
      if (!host.isConnected) {
        entry.cleanup();
        mounted.delete(host);
      }
    }

    for (const host of options.root.querySelectorAll<HTMLElement>('[data-testid="HoverCard"], [role="dialog"], [role="tooltip"]')) {
      const hasHoverSignals = host.dataset.testid === 'HoverCard'
        || Boolean(host.querySelector('img[src*="profile_images"]') && host.querySelector('[data-testid="UserName"]'));
      if (!hasHoverSignals) continue;
      mount(host, 'hover-card', extractHoverCardProfile(host));
    }

    const profileRoot = options.root.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
    const userName = profileRoot?.querySelector<HTMLElement>('[data-testid="UserName"]');
    const profileHost = userName?.parentElement ?? profileRoot;
    if (profileRoot && profileHost) {
      mount(profileHost, 'full-profile', extractFullProfile(profileRoot, currentUrl));
    }
  };

  const queueScan = () => {
    if (queued) return;
    queued = true;
    scanTimer = setTimeout(scan, 100);
  };

  const observer = new MutationObserver(queueScan);
  observer.observe(options.root, { childList: true, subtree: true });
  queueScan();

  return {
    disconnect() {
      observer.disconnect();
      if (scanTimer !== undefined) clearTimeout(scanTimer);
      for (const entry of mounted.values()) entry.cleanup();
      mounted.clear();
    },
  };
}

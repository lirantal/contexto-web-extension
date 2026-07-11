import { parseXProfileUrl } from '@/src/shared/platforms/x';
import type { ProfileSnapshot } from '@/src/shared/types';

export type XSurfaceKind = 'hover-card' | 'full-profile';

function compactText(value: string | null | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').trim() || undefined;
}

function readHandle(surface: HTMLElement): string | undefined {
  return [...surface.querySelectorAll('span')]
    .map((node) => compactText(node.textContent))
    .find((value) => /^@[A-Za-z0-9_]{1,15}$/.test(value ?? ''))
    ?.slice(1);
}

function readDisplayName(surface: HTMLElement, handle: string): string | undefined {
  const userName = surface.querySelector('[data-testid="UserName"]');
  const values = [...(userName ?? surface).querySelectorAll('span')]
    .map((node) => compactText(node.textContent))
    .filter((value): value is string => Boolean(value));
  const handleIndex = values.findIndex((value) => value.toLowerCase() === `@${handle.toLowerCase()}`);
  return values.find((value, index) => index !== handleIndex && !value.startsWith('@'));
}

function snapshot(surface: HTMLElement, profileUrl: string, identityHandle?: string): ProfileSnapshot | null {
  const parsed = parseXProfileUrl(profileUrl);
  if (!parsed) return null;
  const handle = identityHandle ?? readHandle(surface) ?? parsed.handle;
  return {
    ...parsed,
    handle,
    displayName: readDisplayName(surface, handle) ?? handle,
    avatarUrl: surface.querySelector<HTMLImageElement>('img[src*="profile_images"]')?.src,
    bioSnapshot: compactText(surface.querySelector('[data-testid="UserDescription"]')?.textContent),
    location: compactText(surface.querySelector('[data-testid="UserLocation"]')?.textContent),
    capturedAt: new Date().toISOString(),
  };
}

export function extractHoverCardProfile(surface: HTMLElement): ProfileSnapshot | null {
  const handle = readHandle(surface);
  if (!handle) return null;
  const anchor = [...surface.querySelectorAll<HTMLAnchorElement>('a[href]')].find((link) => {
    try {
      return new URL(link.href).pathname.toLowerCase() === `/${handle.toLowerCase()}`;
    } catch {
      return false;
    }
  });
  return anchor ? snapshot(surface, `https://x.com/${handle}`) : null;
}

export function extractFullProfile(surface: HTMLElement, currentUrl: string): ProfileSnapshot | null {
  const parsed = parseXProfileUrl(currentUrl);
  const userName = surface.querySelector<HTMLElement>('[data-testid="UserName"]');
  const scopedHandle = userName ? readHandle(userName) : undefined;
  if (!parsed || !scopedHandle || scopedHandle.toLowerCase() !== parsed.handle.toLowerCase()) return null;
  return snapshot(surface, currentUrl, parsed.handle);
}

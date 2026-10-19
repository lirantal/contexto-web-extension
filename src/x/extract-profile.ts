import { parseXProfileUrl } from '@/src/shared/platforms/x';
import type { ProfileSnapshot } from '@/src/shared/types';

export type XSurfaceKind = 'hover-card' | 'full-profile' | 'feed-post';

function compactText(value: string | null | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').trim() || undefined;
}

function readHandle(surface: HTMLElement): string | undefined {
  return [...surface.querySelectorAll('span')]
    .map((node) => compactText(node.textContent))
    .find((value) => /^@[A-Za-z0-9_]{1,15}$/.test(value ?? ''))
    ?.slice(1);
}

function anchorPath(anchor: HTMLAnchorElement): string | null {
  try {
    return new URL(anchor.getAttribute('href') ?? anchor.href, document.baseURI).pathname.replace(/\/$/, '').toLowerCase();
  } catch {
    return null;
  }
}

function readNameBeforeHandle(scope: ParentNode, handle: string): string | undefined {
  const spans = Array.from(scope.querySelectorAll('span'));
  const handleIndex = spans.findIndex((span) => compactText(span.textContent)?.toLowerCase() === `@${handle.toLowerCase()}`);
  if (handleIndex < 0) return undefined;
  for (let index = handleIndex - 1; index >= 0; index -= 1) {
    const value = compactText(spans[index].textContent);
    if (!value || value.startsWith('@') || spans[index].closest('button,[role="button"]')) continue;
    return value;
  }
  return undefined;
}

function readDisplayName(surface: HTMLElement, handle: string): string | undefined {
  const profilePath = `/${handle.replace(/^@/, '').toLowerCase()}`;
  const identityLink = Array.from(surface.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .find((anchor) => anchorPath(anchor) === profilePath && readNameBeforeHandle(anchor, handle));
  return readNameBeforeHandle(identityLink ?? surface.querySelector('[data-testid="UserName"]') ?? surface, handle);
}

// X wraps the profile website in t.co; prefer a complete visible URL when available.
function readWebsite(surface: HTMLElement): string | undefined {
  const anchor = [...surface.querySelectorAll<HTMLAnchorElement>('a[data-testid="UserUrl"][href]')]
    .find((node) => !node.closest('article,[data-testid="tweet"],[data-testid="UserDescription"]'));
  if (!anchor) return undefined;
  function httpUrl(value: string | null | undefined): URL | undefined {
    if (!value || /[\s…]/.test(value) || value.includes('...')) return undefined;
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      return /^https?:$/.test(url.protocol) && url.hostname.includes('.') && !url.username && !url.password ? url : undefined;
    } catch {
      return undefined;
    }
  }
  const target = httpUrl(anchor.getAttribute('href'));
  if (!target) return undefined;
  if (target.hostname !== 't.co') return target.href;
  return (httpUrl(compactText(anchor.getAttribute('title'))) ?? httpUrl(compactText(anchor.textContent)) ?? target).href;
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
    website: readWebsite(surface),
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

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

function readAudienceCount(surface: HTMLElement, handle: string, suffixes: string[]): number | undefined {
  const counts = new Set<number>();
  for (const anchor of surface.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (anchor.closest('article,[data-testid="tweet"],[data-testid="UserDescription"]')) continue;
    let url;
    try { url = new URL(anchor.getAttribute('href')!, 'https://x.com'); } catch { continue; }
    if (!['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'].includes(url.hostname)
      || !suffixes.some(suffix => url.pathname.replace(/\/$/, '').toLowerCase() === `/${handle.toLowerCase()}/${suffix}`)) continue;
    for (const span of anchor.querySelectorAll('span')) {
      for (const text of [span.getAttribute('title'), compactText(span.textContent)]) {
        if (!text || !/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) continue;
        const value = Number(text.replace(/,/g, ''));
        if (Number.isSafeInteger(value)) counts.add(value);
      }
    }
  }
  return counts.size === 1 ? [...counts][0] : undefined;
}

function viewerHandle(): string | undefined {
  const handles = new Set<string>();
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('nav a[data-testid="AppTabBar_Profile_Link"][href]')) {
    let url;
    try { url = new URL(anchor.getAttribute('href')!, 'https://x.com'); } catch { continue; }
    const parsed = parseXProfileUrl(url.href);
    if (parsed && url.pathname.replace(/\/$/, '').toLowerCase() === `/${parsed.handle}`) handles.add(parsed.handle);
  }
  return handles.size === 1 ? [...handles][0] : undefined;
}

function snapshot(surface: HTMLElement, profileUrl: string, identityHandle?: string): ProfileSnapshot | null {
  const parsed = parseXProfileUrl(profileUrl);
  if (!parsed) return null;
  const handle = identityHandle ?? readHandle(surface) ?? parsed.handle;
  const capturedAt = new Date().toISOString();
  const followersCount = readAudienceCount(surface, handle, ['followers', 'verified_followers']);
  const followingCount = readAudienceCount(surface, handle, ['following']);
  const viewer = viewerHandle();
  const identities = [...surface.querySelectorAll<HTMLElement>('[data-testid="UserName"]')]
    .filter(node => !node.closest('article') && readHandle(node)?.toLowerCase() === handle.toLowerCase());
  const followsYou = !!viewer && identities.length === 1 && [...identities[0].querySelectorAll('[data-testid="userFollowIndicator"]')].some(node =>
    !node.closest('button,[role="button"]') && compactText(node.textContent) === 'Follows you');
  return {
    ...parsed,
    handle,
    displayName: readDisplayName(surface, handle) ?? handle,
    avatarUrl: surface.querySelector<HTMLImageElement>('img[src*="profile_images"]')?.src,
    bioSnapshot: compactText(surface.querySelector('[data-testid="UserDescription"]')?.textContent),
    website: readWebsite(surface),
    location: compactText(surface.querySelector('[data-testid="UserLocation"]')?.textContent),
    ...(followersCount !== undefined ? { followersCount, followersCountObservedAt: capturedAt } : {}),
    ...(followingCount !== undefined ? { followingCount, followingCountObservedAt: capturedAt } : {}),
    ...(followsYou ? { followsYou: true, followsYouViewerHandle: viewer, followsYouObservedAt: capturedAt } : {}),
    capturedAt,
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

import type { ProfileSnapshot, SearchDirection, XSearchFilters } from '../types';

const RESERVED_X_PATHS = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'i',
  'search',
  'settings',
  'compose',
  'intent',
  'share',
  'login',
  'logout',
  'privacy',
  'tos',
  'jobs',
  'download',
]);

const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/i;

export function normalizeXHandle(handle: string): string {
  return handle.trim().replace(/^@/, '').replace(/^\/+/, '').toLowerCase();
}

export function isValidXHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(normalizeXHandle(handle));
}

export function parseXProfileUrl(rawUrl: string): ProfileSnapshot | null {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)) {
    return null;
  }

  const [firstSegment] = url.pathname.split('/').filter(Boolean);
  if (!firstSegment) return null;

  const normalizedHandle = normalizeXHandle(firstSegment);
  if (RESERVED_X_PATHS.has(normalizedHandle) || !isValidXHandle(normalizedHandle)) {
    return null;
  }

  return {
    platform: 'x',
    handle: firstSegment.replace(/^@/, ''),
    profileUrl: `https://x.com/${normalizedHandle}`,
  };
}

export function parseXPostUrl(rawUrl: string): { handle: string; postId: string; postUrl: string } | null {
  let url: URL;

  try {
    url = new URL(rawUrl, 'https://x.com');
  } catch {
    return null;
  }

  if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase())) {
    return null;
  }

  const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)\/?$/);
  if (!match) return null;

  const handle = normalizeXHandle(match[1]);
  if (RESERVED_X_PATHS.has(handle) || !isValidXHandle(handle)) return null;

  const postId = match[2];
  return { handle, postId, postUrl: `https://x.com/${handle}/status/${postId}` };
}

// Only profile views and canonical conversation URLs provide search identity.
export function parseXSearchTargetUrl(rawUrl: string): string | undefined {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return undefined; }
  if (!/^https?:$/.test(url.protocol)) return undefined;
  const post = parseXPostUrl(rawUrl);
  if (post) return post.handle;
  if (!/^\/[A-Za-z0-9_]{1,15}\/?$/.test(url.pathname)) return undefined;
  const profile = parseXProfileUrl(rawUrl);
  return profile ? normalizeXHandle(profile.handle) : undefined;
}

export function buildXSearchQuery(filters: XSearchFilters): string {
  const viewer = filters.viewerHandle ? normalizeXHandle(filters.viewerHandle) : '';
  const target = filters.targetHandle ? normalizeXHandle(filters.targetHandle) : '';
  const parts: string[] = [];

  const direction = filters.direction;
  if (direction === 'me-to-them') {
    if (viewer) parts.push(`from:${viewer}`);
    if (target) parts.push(`to:${target}`);
  }

  if (direction === 'them-to-me') {
    if (target) parts.push(`from:${target}`);
    if (viewer) parts.push(`to:${viewer}`);
  }

  if (direction === 'from-profile' && target) {
    parts.push(`from:${target}`);
  }

  if (direction === 'to-profile' && target) {
    parts.push(`to:${target}`);
  }

  if (direction === 'mentions' && target) {
    parts.push(`@${target}`);
  }

  if (filters.keyword?.trim()) {
    parts.push(filters.keyword.trim());
  }

  if (filters.since) {
    parts.push(`since:${filters.since}`);
  }

  if (filters.until) {
    parts.push(`until:${filters.until}`);
  }

  return parts.join(' ').trim();
}

export function canRunXSearch(filters: XSearchFilters): boolean {
  const viewer = filters.viewerHandle?.trim() ?? '';
  const target = filters.targetHandle?.trim() ?? '';

  if (filters.direction === 'me-to-them' || filters.direction === 'them-to-me') {
    return isValidXHandle(viewer) && (!target || isValidXHandle(target));
  }

  if (
    filters.direction === 'from-profile'
    || filters.direction === 'to-profile'
    || filters.direction === 'mentions'
  ) {
    return isValidXHandle(target);
  }

  return false;
}

export function buildXSearchUrl(filters: XSearchFilters): string {
  const query = buildXSearchQuery(filters);
  const params = new URLSearchParams({ q: query, src: 'typed_query', f: 'live' });
  return `https://x.com/search?${params.toString()}`;
}

export function buildXInteractionSearchUrl(viewerHandle: string, targetHandle: string): string | null {
  if (!isValidXHandle(viewerHandle) || !isValidXHandle(targetHandle)) return null;

  const viewer = normalizeXHandle(viewerHandle);
  const target = normalizeXHandle(targetHandle);
  const query = `(from:${viewer} to:${target}) OR (from:${target} to:${viewer})`;
  const params = new URLSearchParams({ q: query, src: 'typed_query', f: 'live' });
  return `https://x.com/search?${params.toString()}`;
}

export function buildXCatchUpSearchUrl(targetHandle: string, lastCatchUpAt?: string): string | null {
  if (!isValidXHandle(targetHandle)) return null;

  let since = '';
  if (lastCatchUpAt !== undefined) {
    const checkpoint = new Date(lastCatchUpAt);
    if (Number.isNaN(checkpoint.getTime())) return null;
    since = checkpoint.toISOString().slice(0, 10);
  }

  return buildXSearchUrl({
    targetHandle: normalizeXHandle(targetHandle),
    since,
    direction: 'from-profile',
  });
}

export function labelSearchDirection(direction: SearchDirection): string {
  const labels: Record<SearchDirection, string> = {
    'me-to-them': 'Messages I sent',
    'them-to-me': 'Messages to me',
    'from-profile': 'Posts from profile',
    'to-profile': 'Posts to profile',
    mentions: 'Mentions',
  };

  return labels[direction];
}

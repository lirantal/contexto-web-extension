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

export function buildXSearchQuery(filters: XSearchFilters): string {
  const viewer = filters.viewerHandle ? normalizeXHandle(filters.viewerHandle) : '';
  const target = filters.targetHandle ? normalizeXHandle(filters.targetHandle) : '';
  const parts: string[] = [];

  const direction = filters.direction;
  if (direction === 'me-to-them' && viewer && target) {
    parts.push(`from:${viewer}`, `to:${target}`);
  }

  if (direction === 'them-to-me' && viewer && target) {
    parts.push(`from:${target}`, `to:${viewer}`);
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

export function buildXSearchUrl(filters: XSearchFilters): string {
  const query = buildXSearchQuery(filters);
  const params = new URLSearchParams({ q: query, src: 'typed_query', f: 'live' });
  return `https://x.com/search?${params.toString()}`;
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

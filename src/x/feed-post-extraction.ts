import { normalizeXHandle, parseXPostUrl, parseXProfileUrl } from '@/src/shared/platforms/x';
import type { ProfileSnapshot, XPostSnapshot } from '@/src/shared/types';

interface FeedPostIdentity {
  container: HTMLElement;
  anchor: HTMLAnchorElement;
  handle: string;
  displayName: string;
}

function compactText(value: string | null | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').trim() || undefined;
}

function anchorPath(anchor: HTMLAnchorElement): string | null {
  try {
    return new URL(anchor.getAttribute('href') ?? anchor.href, document.baseURI).pathname.replace(/\/$/, '').toLowerCase();
  } catch {
    return null;
  }
}

function readHandle(container: HTMLElement): string | undefined {
  return [...container.querySelectorAll('span')]
    .map((node) => compactText(node.textContent))
    .find((value) => /^@[A-Za-z0-9_]{1,15}$/.test(value ?? ''))
    ?.slice(1);
}

function readDisplayName(scope: HTMLElement, handle: string): string | undefined {
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

function isPromoted(post: HTMLElement): boolean {
  return post.matches('[data-testid="placementTracking"], [data-testid="promotedIndicator"]')
    || Boolean(post.querySelector('[data-testid="placementTracking"], [data-testid="promotedIndicator"]'))
    || Array.from(post.querySelectorAll<HTMLElement>('[aria-label]')).some((node) => /\bpromoted\b/i.test(node.getAttribute('aria-label') ?? ''));
}

function isNestedIdentity(candidate: HTMLElement, post: HTMLElement): boolean {
  return candidate.closest<HTMLElement>('[data-testid="tweet"]') !== post;
}

function isInsideNestedPostCard(node: HTMLElement, post: HTMLElement): boolean {
  const card = node.parentElement?.closest<HTMLElement>(
    '[data-testid="quoteTweet"], [data-testid="card.wrapper"], [role="link"]',
  );
  return Boolean(card && card !== post && card.closest<HTMLElement>('[data-testid="tweet"]') === post);
}

export function findFeedPostIdentity(post: HTMLElement): FeedPostIdentity | null {
  if (isPromoted(post)) return null;
  const candidates = Array.from(post.querySelectorAll<HTMLElement>('[data-testid="User-Name"], [data-testid="UserName"]'))
    .filter((candidate) => !isNestedIdentity(candidate, post) && !isInsideNestedPostCard(candidate, post));
  const identities: FeedPostIdentity[] = [];

  for (const container of candidates) {
    const handle = readHandle(container);
    if (!handle) continue;
    const normalizedHandle = normalizeXHandle(handle);
    const anchor = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .find((link) => anchorPath(link) === `/${normalizedHandle}`);
    if (!anchor) continue;
    const displayName = readDisplayName(container, handle);
    if (!displayName) continue;
    identities.push({ container, anchor, handle: normalizedHandle, displayName });
  }
  const signatures = new Set(identities.map(({ handle, displayName }) => `${handle}\0${displayName}`));
  return signatures.size === 1 ? identities[0] : null;
}

export function extractFeedPostProfile(post: HTMLElement): ProfileSnapshot | null {
  const identity = findFeedPostIdentity(post);
  if (!identity) return null;
  const profile = parseXProfileUrl(`https://x.com/${identity.handle}`);
  if (!profile) return null;
  return {
    ...profile,
    displayName: identity.displayName,
    avatarUrl: identity.container.querySelector<HTMLImageElement>('img[src*="profile_images"]')?.src,
    capturedAt: new Date().toISOString(),
  };
}

export function extractFeedPostSnapshot(post: HTMLElement): XPostSnapshot | null {
  const identity = findFeedPostIdentity(post);
  if (!identity || isPromoted(post)) return null;

  const candidates = Array.from(post.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((anchor) => anchor.closest<HTMLElement>('[data-testid="tweet"]') === post
      && !isInsideNestedPostCard(anchor, post))
    .map((anchor) => parseXPostUrl(anchor.getAttribute('href') ?? anchor.href))
    .filter((snapshot) => snapshot?.handle === identity.handle);
  const unique = new Map(candidates.map((snapshot) => [snapshot!.postUrl, snapshot!]));
  if (unique.size !== 1) return null;

  const source = unique.values().next().value;
  if (!source) return null;
  const excerptNode = Array.from(post.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
    .find((node) => node.closest<HTMLElement>('[data-testid="tweet"]') === post
      && !isInsideNestedPostCard(node, post));
  const excerpt = compactText(excerptNode?.textContent);

  return {
    platform: 'x',
    authorHandle: identity.handle,
    postId: source.postId,
    postUrl: source.postUrl,
    excerpt: excerpt ? [...excerpt].slice(0, 280).join('') : undefined,
  };
}

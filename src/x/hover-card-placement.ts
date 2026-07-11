export interface HoverCardInsertion {
  parent: HTMLElement;
  before: ChildNode | null;
}

function anchorPath(anchor: HTMLAnchorElement): string | null {
  try {
    return new URL(anchor.getAttribute('href') ?? anchor.href, document.baseURI).pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function nearestCommonAncestor(first: HTMLElement, second: HTMLElement, boundary: HTMLElement): HTMLElement | null {
  for (let candidate: HTMLElement | null = first; candidate && candidate !== boundary; candidate = candidate.parentElement) {
    if (candidate.contains(second)) return candidate;
  }
  return null;
}

function innerCardContainer(host: HTMLElement): HTMLElement {
  const userName = host.querySelector<HTMLElement>('[data-testid="UserName"]');
  if (!userName) return host;
  if (userName.parentElement === host) return host;

  let container = userName;
  while (container.parentElement && container.parentElement !== host) container = container.parentElement;
  return container;
}

export function resolveHoverCardInsertion(host: HTMLElement, handle: string): HoverCardInsertion {
  const container = innerCardContainer(host);
  const normalizedHandle = handle.replace(/^@/, '').toLowerCase();
  const profilePath = `/${normalizedHandle}`;
  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'));
  const pathFor = (anchor: HTMLAnchorElement) => anchorPath(anchor)?.toLowerCase();
  const following = anchors.find((anchor) => pathFor(anchor) === `${profilePath}/following`);
  const followerPaths = new Set([`${profilePath}/followers`, `${profilePath}/verified_followers`]);
  const followers = anchors.find((anchor) => followerPaths.has(pathFor(anchor) ?? ''));

  if (following && followers) {
    const countsRow = nearestCommonAncestor(following, followers, container);
    if (countsRow?.parentElement && container.contains(countsRow.parentElement)) {
      return { parent: countsRow.parentElement, before: countsRow.nextSibling };
    }
  }

  const profileCta = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[role="button"][href]'))
    .find((anchor) => anchorPath(anchor)?.toLowerCase() === profilePath);

  if (profileCta?.parentElement && container.contains(profileCta.parentElement)) {
    return { parent: profileCta.parentElement, before: profileCta };
  }
  return { parent: container, before: null };
}

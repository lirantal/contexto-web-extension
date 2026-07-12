import { afterEach, describe, expect, it } from 'vitest';
import { resolveHoverCardInsertion } from '@/src/x/hover-card-placement';

afterEach(() => {
  document.body.innerHTML = '';
});

function buildCard(followerPath: string) {
  const card = document.createElement('div');
  card.dataset.testid = 'HoverCard';
  card.innerHTML = `
    <div data-testid="inner-card">
      <div data-testid="UserName"><span>Amanda</span><span>@amanda</span></div>
      <div data-testid="counts">
        <a href="/amanda/following">1,724 Following</a>
        <a href="${followerPath}">3,149 Followers</a>
      </div>
      <div data-testid="mutuals">Followed by Shaun Smith</div>
      <a role="button" href="/amanda">View Profile</a>
    </div>`;
  document.body.append(card);
  return card;
}

describe('resolveHoverCardInsertion', () => {
  it('places the launcher after both links inside their shared count container', () => {
    const card = buildCard('/amanda/followers');
    const counts = card.querySelector<HTMLElement>('[data-testid="counts"]')!;

    const location = resolveHoverCardInsertion(card, 'amanda');

    expect(location).toEqual({ parent: counts, before: null });
    expect(Array.from(counts.querySelectorAll('a')).map((anchor) => anchor.textContent)).toEqual([
      '1,724 Following',
      '3,149 Followers',
    ]);
  });

  it('recognizes X verified-follower links as the follower count', () => {
    const card = buildCard('/amanda/verified_followers');
    const counts = card.querySelector<HTMLElement>('[data-testid="counts"]')!;

    const location = resolveHoverCardInsertion(card, 'amanda');

    expect(location).toEqual({ parent: counts, before: null });
  });

  it('falls back inside the inner card before the profile CTA', () => {
    const card = buildCard('/amanda/connections');
    card.querySelector('a[href="/amanda/following"]')?.remove();
    const inner = card.querySelector<HTMLElement>('[data-testid="inner-card"]')!;
    const cta = card.querySelector<HTMLElement>('a[role="button"]')!;

    const location = resolveHoverCardInsertion(card, '@amanda');

    expect(location.parent).toBe(inner);
    expect(location.before).toBe(cta);
    expect(card.contains(location.parent)).toBe(true);
  });

  it('does not use a direct-child username as the fallback container', () => {
    const card = document.createElement('div');
    card.innerHTML = `
      <div data-testid="UserName"><span>Amanda</span><span>@amanda</span></div>
      <a role="button" href="/amanda">View Profile</a>`;
    const cta = card.querySelector<HTMLElement>('a[role="button"]')!;

    const location = resolveHoverCardInsertion(card, 'amanda');

    expect(location).toEqual({ parent: card, before: cta });
  });

  it('rejects a common ancestor that is the entire inner card', () => {
    const card = document.createElement('div');
    card.innerHTML = `
      <div data-testid="inner-card">
        <div data-testid="UserName"><span>Amanda</span><span>@amanda</span></div>
        <div><a href="/amanda/following">1,724 Following</a></div>
        <div><a href="/amanda/followers">3,149 Followers</a></div>
        <a role="button" href="/amanda">View Profile</a>
      </div>`;
    const inner = card.querySelector<HTMLElement>('[data-testid="inner-card"]')!;
    const cta = card.querySelector<HTMLElement>('a[role="button"]')!;

    const location = resolveHoverCardInsertion(card, 'amanda');

    expect(location).toEqual({ parent: inner, before: cta });
  });

  it('ignores count-like links for another profile', () => {
    const card = buildCard('/other/followers');
    const inner = card.querySelector<HTMLElement>('[data-testid="inner-card"]')!;
    const cta = card.querySelector<HTMLElement>('a[role="button"]')!;

    const location = resolveHoverCardInsertion(card, 'amanda');

    expect(location).toEqual({ parent: inner, before: cta });
  });

  it('uses the hover root as a final in-flow fallback', () => {
    const card = document.createElement('div');

    expect(resolveHoverCardInsertion(card, 'amanda')).toEqual({ parent: card, before: null });
  });
});

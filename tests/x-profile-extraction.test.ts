import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFullProfile, extractHoverCardProfile } from '@/src/x/extract-profile';

const hoverCardActionBeforeIdentity = readFileSync(
  resolve('tests/fixtures/x/hover-card-action-before-identity.html'),
  'utf8',
);

describe('X surface profile extraction', () => {
  it('captures the complete visible website behind the profile t.co link', () => {
    document.body.innerHTML = readFileSync(resolve('tests/fixtures/x/profile-shortened-website.html'), 'utf8');
    const root = document.querySelector<HTMLElement>('main')!;
    expect(extractFullProfile(root, 'https://x.com/exampledev')).toMatchObject({ website: 'https://arize.com/', location: 'Berkeley, CA' });
    root.querySelector('[data-testid="UserUrl"]')!.remove();
    expect(extractFullProfile(root, 'https://x.com/exampledev')?.website).toBeUndefined();
  });

  it.each([
    ['https://example.com/path', 'example.com/…', 'https://example.com/path'],
    ['https://t.co/short', 'example.com/…', 'https://t.co/short'],
    ['javascript:alert(1)', 'example.com', undefined],
    ['https://t.co/short', 'javascript:alert(1)', 'https://t.co/short'],
  ])('handles website href %s and label %s', (href, label, website) => {
    const root = document.createElement('div');
    root.innerHTML = '<a href="/exampledev"><span>Example</span><span>@exampledev</span></a><a data-testid="UserUrl"></a>';
    const link = root.querySelector('[data-testid="UserUrl"]')!;
    link.setAttribute('href', href);
    link.textContent = label;
    expect(extractHoverCardProfile(root)?.website).toBe(website);
  });
  it('extracts only the hovered account from its dialog', () => {
    document.body.innerHTML = `
      <a href="/wrong"><span>Wrong</span><span>@wrong</span></a>
      <div role="dialog" data-testid="HoverCard">
        <a href="/theo"><img src="https://pbs.twimg.com/profile_images/theo.jpg"></a>
        <a href="/theo"><span>Theo – t3.gg</span><span>@theo</span></a>
        <div data-testid="UserDescription">Developer and CEO</div>
      </div>`;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(extractHoverCardProfile(dialog)).toMatchObject({
      platform: 'x',
      handle: 'theo',
      displayName: 'Theo – t3.gg',
      profileUrl: 'https://x.com/theo',
      bioSnapshot: 'Developer and CEO',
    });
  });

  it('extracts a full profile from the provided profile root', () => {
    document.body.innerHTML = `
      <main data-testid="primaryColumn">
        <div data-testid="UserName"><span>Example Dev</span><span>@exampledev</span></div>
        <div data-testid="UserDescription">Security engineer</div>
        <span data-testid="UserLocation">Berlin</span>
        <img src="https://pbs.twimg.com/profile_images/example.jpg">
      </main>`;
    expect(extractFullProfile(document.querySelector<HTMLElement>('main')!, 'https://x.com/exampledev')).toMatchObject({
      handle: 'exampledev', displayName: 'Example Dev', location: 'Berlin',
    });
  });

  it('returns null for reserved routes and malformed cards', () => {
    expect(extractHoverCardProfile(document.createElement('div'))).toBeNull();
    expect(extractFullProfile(document.createElement('main'), 'https://x.com/home')).toBeNull();
  });

  it('rejects a full profile when the scoped identity does not match the URL', () => {
    const root = document.createElement('main');
    root.innerHTML = '<div data-testid="UserName"><span>Wrong User</span><span>@wrong</span></div>';
    expect(extractFullProfile(root, 'https://x.com/exampledev')).toBeNull();
  });

  it('waits for the scoped profile identity instead of reading post handles', () => {
    const root = document.createElement('main');
    root.innerHTML = '<article><span>@wrong</span><a href="/wrong">Wrong</a></article>';
    expect(extractFullProfile(root, 'https://x.com/exampledev')).toBeNull();
  });

  it('extracts the identity name when an action button precedes it in UserName', () => {
    document.body.innerHTML = hoverCardActionBeforeIdentity;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;

    expect(extractHoverCardProfile(dialog)).toMatchObject({
      handle: 'exampledev',
      displayName: 'Example Developer',
    });
  });
});

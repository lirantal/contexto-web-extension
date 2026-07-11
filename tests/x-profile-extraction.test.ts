import { describe, expect, it } from 'vitest';
import { extractFullProfile, extractHoverCardProfile } from '@/src/x/extract-profile';

describe('X surface profile extraction', () => {
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
});

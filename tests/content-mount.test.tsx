import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { detectXTheme, mountContextoSurface } from '@/src/x/mount-contexto-surface';
import { AccountDraftStore } from '@/src/x/draft-store';

vi.mock('@/src/ui/ContextoProfileSurface', () => ({
  ContextoProfileSurface: () => <div>Full Contexto editor</div>,
}));

vi.mock('@/src/ui/ContextoHoverLauncher', () => ({
  ContextoHoverLauncher: () => <div>Hover Contexto launcher</div>,
}));

describe('mountContextoSurface', () => {
  it('mounts an isolated inline root and removes it during cleanup', () => {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.innerHTML = `
      <div data-testid="inner-card">
        <div data-testid="UserName"><span>Theo</span><span>@theo</span></div>
        <div data-testid="counts">
          <a href="/theo/following">12 Following</a>
          <a href="/theo/followers">34 Followers</a>
        </div>
        <a role="button" href="/theo">View Profile</a>
      </div>`;
    document.body.append(host);
    const cleanup = mountContextoSurface({
      surface: {
        kind: 'hover-card', host,
        profile: { platform: 'x', handle: 'theo', profileUrl: 'https://x.com/theo' },
      },
      send: vi.fn(), drafts: new AccountDraftStore(), css: '.contexto-surface{}', theme: 'dark',
      openPageEditor: vi.fn(),
    });
    const mountHost = host.querySelector<HTMLElement>('[data-contexto-surface="hover-card"]');
    expect(mountHost?.shadowRoot).not.toBeNull();
    expect(mountHost?.getAttribute('data-theme')).toBe('dark');
    expect(mountHost?.shadowRoot).toHaveTextContent('Hover Contexto launcher');
    expect(mountHost?.shadowRoot).not.toHaveTextContent('Full Contexto editor');
    expect(mountHost?.parentElement).toBe(host.querySelector('[data-testid="inner-card"]'));
    expect(mountHost?.previousElementSibling).toBe(host.querySelector('[data-testid="counts"]'));
    expect(mountHost?.nextElementSibling).toBe(host.querySelector('a[role="button"]'));
    expect(host.style.position).toBe('fixed');
    cleanup();
    expect(host.style.position).toBe('fixed');
    expect(host.querySelector('[data-contexto-surface]')).toBeNull();
  });


  it('routes full profiles to the complete editor', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const cleanup = mountContextoSurface({
      surface: {
        kind: 'full-profile', host,
        profile: { platform: 'x', handle: 'theo', profileUrl: 'https://x.com/theo' },
      },
      send: vi.fn(), drafts: new AccountDraftStore(), css: '.contexto-surface{}', theme: 'light',
      openPageEditor: vi.fn(),
    });
    const mountHost = host.querySelector<HTMLElement>('[data-contexto-surface="full-profile"]');
    expect(mountHost?.shadowRoot).toHaveTextContent('Full Contexto editor');
    expect(mountHost?.shadowRoot).not.toHaveTextContent('Hover Contexto launcher');
    cleanup();
  });
  it('inherits light theme through transparent X containers', () => {
    const host = document.createElement('div');
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    document.body.append(host);
    expect(detectXTheme(host)).toBe('light');
  });
});

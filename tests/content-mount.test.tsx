import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { detectXTheme, mountContextoSurface } from '@/src/x/mount-contexto-surface';
import { AccountDraftStore } from '@/src/x/draft-store';
import { mountContextoSidebarSearch } from '@/src/x/mount-contexto-sidebar-search';

vi.mock('@/src/ui/ContextoProfileSurface', () => ({
  ContextoProfileSurface: () => <div>Full Contexto editor</div>,
}));

vi.mock('@/src/ui/ContextoHoverLauncher', () => ({
  ContextoHoverLauncher: () => <div>Hover Contexto launcher</div>,
}));

vi.mock('@/src/ui/ContextoSidebarWorkspace', () => ({
  ContextoSidebarWorkspace: () => <>
    <section aria-label="Contexto account search">Contexto account search</section>
    <section aria-label="Quick X search">
      Quick X search
      <button type="button" data-testid="quick-x-launch">Launch X search</button>
    </section>
  </>,
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
    const counts = host.querySelector<HTMLElement>('[data-testid="counts"]')!;
    expect(mountHost?.parentElement).toBe(counts);
    expect(counts.lastElementChild).toBe(mountHost);
    expect(Array.from(counts.querySelectorAll('a')).map((anchor) => anchor.textContent)).toEqual([
      '12 Following',
      '34 Followers',
    ]);
    expect(host.style.position).toBe('fixed');
    expect(cleanup.isConnected?.()).toBe(true);
    host.querySelector('[data-testid="inner-card"]')?.remove();
    expect(cleanup.isConnected?.()).toBe(false);
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

describe('mountContextoSidebarSearch', () => {
  it('keeps both sidebar sections and launch controls inside a closed shadow root', () => {
    const nativeForm = document.createElement('form');
    document.body.append(nativeForm);
    const originalAttachShadow = HTMLElement.prototype.attachShadow;
    let capturedRoot: ShadowRoot | undefined;
    const attachShadow = vi.spyOn(HTMLElement.prototype, 'attachShadow').mockImplementation(function (
      this: HTMLElement,
      init: ShadowRootInit,
    ) {
      capturedRoot = originalAttachShadow.call(this, init);
      return capturedRoot;
    });

    try {
      const cleanup = mountContextoSidebarSearch({
        nativeForm,
        send: vi.fn().mockResolvedValue({ ok: true, accounts: [] }),
        css: '.contexto-surface{} .contexto-quick-search{}',
        theme: 'dark',
      });

      const mountHost = nativeForm.previousElementSibling as HTMLElement;
      expect(mountHost).toHaveAttribute('data-contexto-surface', 'sidebar-search');
      expect(mountHost.shadowRoot).toBeNull();
      expect(capturedRoot).toBeDefined();
      expect(capturedRoot).toHaveTextContent('Contexto account search');
      expect(capturedRoot).toHaveTextContent('Quick X search');
      expect(capturedRoot?.querySelector('style')).toHaveTextContent('.contexto-surface');
      expect(capturedRoot?.querySelector('style')).toHaveTextContent('.contexto-quick-search');
      expect(capturedRoot?.querySelector('[data-testid="quick-x-launch"]')).not.toBeNull();
      expect(document.querySelector('[data-testid="quick-x-launch"]')).toBeNull();
      expect(cleanup.isConnected?.()).toBe(true);

      cleanup();

      expect(document.querySelector('[data-contexto-surface="sidebar-search"]')).toBeNull();
    } finally {
      attachShadow.mockRestore();
    }
  });

  it('reports connected only while the host is the native form immediate previous sibling', () => {
    const firstParent = document.createElement('div');
    const secondParent = document.createElement('div');
    const nativeForm = document.createElement('form');
    firstParent.append(nativeForm);
    document.body.append(firstParent, secondParent);
    const cleanup = mountContextoSidebarSearch({
      nativeForm,
      send: vi.fn().mockResolvedValue({ ok: true, accounts: [] }),
      css: '.contexto-surface{} .contexto-quick-search{}',
      theme: 'light',
    });
    const mountHost = nativeForm.previousElementSibling as HTMLElement;

    expect(cleanup.isConnected?.()).toBe(true);
    nativeForm.before(document.createElement('span'));
    expect(cleanup.isConnected?.()).toBe(false);
    nativeForm.before(mountHost);
    expect(cleanup.isConnected?.()).toBe(true);
    secondParent.append(nativeForm);
    expect(cleanup.isConnected?.()).toBe(false);
    secondParent.append(mountHost, nativeForm);
    expect(cleanup.isConnected?.()).toBe(true);
    mountHost.remove();
    expect(cleanup.isConnected?.()).toBe(false);

    cleanup();
  });
});

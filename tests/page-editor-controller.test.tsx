import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageEditorController } from '@/src/x/page-editor-controller';
import { AccountDraftStore } from '@/src/x/draft-store';

vi.mock('@/src/ui/ContextoProfileSurface', () => ({
  ContextoProfileSurface: ({ profile, placement }: { profile: { handle: string }; placement: string }) => {
    const [mountedHandle] = React.useState(profile.handle);
    return <button type="button" data-testid="editor">{mountedHandle}:{profile.handle}:{placement}</button>;
  },
}));

const profile = { platform: 'x' as const, handle: 'theo', profileUrl: 'https://x.com/theo' };

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    get matches() { return matches; },
    media: '(min-width: 1100px)', onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return {
    setMatches(next: boolean) {
      matches = next;
      for (const listener of listeners) listener({ matches: next, media: query.media } as MediaQueryListEvent);
    },
    listeners,
  };
}

describe('page editor controller', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders a wide-screen panel under the Contexto-owned root instead of X sidebar content', () => {
    installMatchMedia(true);
    const hover = document.createElement('div');
    const button = document.createElement('button');
    hover.append(button);
    const rail = document.createElement('aside');
    rail.dataset.testid = 'sidebarColumn';
    rail.append(document.createElement('div'), document.createElement('div'));
    document.body.append(hover, rail);
    const controller = createPageEditorController({
      root: document.body,
      send: vi.fn(),
      drafts: new AccountDraftStore(),
      css: '.contexto-surface{}',
    });

    controller.open(profile, button);

    const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]');
    expect(host?.parentElement).toBe(document.body);
    expect(rail.contains(host)).toBe(false);
    expect(host?.dataset.placement).toBe('docked');
    hover.remove();
    expect(host?.isConnected).toBe(true);
    controller.disconnect();
  });

  it('uses the same body-owned host when changing from panel to modal', () => {
    const viewport = installMatchMedia(true);
    const button = document.createElement('button');
    document.body.append(button);
    const controller = createPageEditorController({ root: document.body, send: vi.fn(), drafts: new AccountDraftStore(), css: '' });

    controller.open(profile, button);
    const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
    viewport.setMatches(false);

    expect(document.querySelector('[data-contexto-page-editor]')).toBe(host);
    expect(host.parentElement).toBe(document.body);
    expect(host.dataset.placement).toBe('modal');
    controller.disconnect();
    expect(viewport.listeners.size).toBe(0);
  });

  it('starts in modal fallback and removes its host on disconnect', () => {
    const button = document.createElement('button');
    installMatchMedia(false);
    document.body.append(button);
    const drafts = new AccountDraftStore();
    const controller = createPageEditorController({ root: document.body, send: vi.fn(), drafts, css: '' });

    controller.open(profile, button);
    const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
    expect(host.parentElement).toBe(document.body);
    expect(host.dataset.placement).toBe('modal');
    expect(host.shadowRoot?.activeElement).toBe(host.shadowRoot?.querySelector('button'));

    drafts.set(profile.handle, { metadata: { displayName: 'Theo', position: 'CEO', profession: '', companyName: '', location: '', relationshipSource: '' }, tagNames: [], folderNames: [] });
    host.shadowRoot?.querySelector('button')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.isConnected).toBe(true);

    drafts.clear(profile.handle);
    host.shadowRoot?.querySelector('button')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.isConnected).toBe(false);
    expect(document.activeElement).toBe(button);

    controller.disconnect();
  });

  it('remounts profile-scoped editor state when switching clean accounts', () => {
    const button = document.createElement('button');
    installMatchMedia(true);
    document.body.append(button);
    const controller = createPageEditorController({ root: document.body, send: vi.fn(), drafts: new AccountDraftStore(), css: '' });

    controller.open(profile, button);
    controller.open({ ...profile, handle: 'alice', profileUrl: 'https://x.com/alice' }, button);

    const editor = document.querySelector<HTMLElement>('[data-contexto-page-editor]')?.shadowRoot?.querySelector('[data-testid="editor"]');
    expect(editor).toHaveTextContent('alice:alice:docked');
    controller.disconnect();
  });
});

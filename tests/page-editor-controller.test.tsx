import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageEditorController } from '@/src/x/page-editor-controller';
import { AccountDraftStore } from '@/src/x/draft-store';

vi.mock('@/src/ui/ContextoProfileSurface', () => ({
  ContextoProfileSurface: ({ profile, placement }: { profile: { handle: string }; placement: string }) => (
    <button type="button" data-testid="editor">{profile.handle}:{placement}</button>
  ),
}));

const profile = { platform: 'x' as const, handle: 'theo', profileUrl: 'https://x.com/theo' };

async function flushPlacement() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 60));
}

describe('page editor controller', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('docks outside the hover card and survives its removal', async () => {
    const hover = document.createElement('div');
    const button = document.createElement('button');
    hover.append(button);
    const rail = document.createElement('aside');
    rail.dataset.testid = 'sidebarColumn';
    document.body.append(hover, rail);
    const controller = createPageEditorController({
      root: document.body,
      send: vi.fn(),
      drafts: new AccountDraftStore(),
      css: '.contexto-surface{}',
    });

    controller.open(profile, button);

    const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]');
    expect(host?.parentElement).toBe(rail);
    expect(host?.dataset.placement).toBe('docked');
    hover.remove();
    expect(host?.isConnected).toBe(true);
    controller.disconnect();
  });

  it('moves the same open editor to modal fallback when the rail disappears', async () => {
    const rail = document.createElement('aside');
    rail.dataset.testid = 'sidebarColumn';
    const button = document.createElement('button');
    document.body.append(button, rail);
    const controller = createPageEditorController({ root: document.body, send: vi.fn(), drafts: new AccountDraftStore(), css: '' });

    controller.open(profile, button);
    const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
    rail.remove();
    await flushPlacement();

    expect(document.querySelector('[data-contexto-page-editor]')).toBe(host);
    expect(host.parentElement).toBe(document.body);
    expect(host.dataset.placement).toBe('modal');
    controller.disconnect();
  });

  it('starts in modal fallback and removes its host on disconnect', () => {
    const button = document.createElement('button');
    document.body.append(button);
    const controller = createPageEditorController({ root: document.body, send: vi.fn(), drafts: new AccountDraftStore(), css: '' });

    controller.open(profile, button);
    const host = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
    expect(host.parentElement).toBe(document.body);
    expect(host.dataset.placement).toBe('modal');
    expect(host.shadowRoot?.activeElement).toBe(host.shadowRoot?.querySelector('button'));

    host.shadowRoot?.querySelector('button')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.isConnected).toBe(false);
    expect(document.activeElement).toBe(button);

    controller.disconnect();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, waitFor } from '@testing-library/react';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { ContextoProfileSurfaceProps } from '@/src/ui/ContextoProfileSurface';
import { AccountDraftStore } from '@/src/x/draft-store';
import { mountContextoSurface } from '@/src/x/mount-contexto-surface';
import { createPageEditorController } from '@/src/x/page-editor-controller';

vi.mock('@/src/ui/ContextoProfileSurface', () => ({
  ContextoProfileSurface: () => <div>Full Contexto editor</div>,
}));

const profile = { platform: 'x' as const, handle: 'pauline', displayName: 'Pauline', profileUrl: 'https://x.com/pauline' };

function installWideViewport() {
  const query = {
    matches: true, media: '(min-width: 1100px)', onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn(() => query));
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('hover Edit integration', () => {
  it('opens a body-owned panel before X removes the Shadow DOM launcher', async () => {
    installWideViewport();
    const hover = document.createElement('div');
    hover.innerHTML = `
      <div data-testid="inner-card">
        <div data-testid="UserName"><span>Pauline</span><span>@pauline</span></div>
        <div data-testid="counts">
          <a href="/pauline/following">12 Following</a>
          <a href="/pauline/followers">34 Followers</a>
        </div>
        <a role="button" href="/pauline">View Profile</a>
      </div>`;
    const sidebar = document.createElement('aside');
    sidebar.dataset.testid = 'sidebarColumn';
    sidebar.append(document.createElement('section'), document.createElement('section'));
    document.body.append(hover, sidebar);
    const send = vi.fn((message: ContextoRequest): Promise<ContextoResponse> => {
      if (message.type === 'contexto:account:lookup') {
        return Promise.resolve({ ok: true, lookup: true, lookupAccount: undefined });
      }
      if (message.type === 'contexto:lookups:list') {
        return Promise.resolve({ ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } });
      }
      return Promise.resolve({ ok: true });
    }) as ContextoProfileSurfaceProps['send'];
    const drafts = new AccountDraftStore();
    const controller = createPageEditorController({ root: document.body, send, drafts, css: '' });
    const cleanup = mountContextoSurface({
      surface: { kind: 'hover-card', host: hover, profile },
      send, drafts, css: '', theme: 'light', openPageEditor: controller.open,
    });

    try {
      const launcherHost = hover.querySelector<HTMLElement>('[data-contexto-surface="hover-card"]')!;
      const edit = await waitFor(() => {
        const button = launcherHost.shadowRoot?.querySelector<HTMLButtonElement>('button');
        expect(button).not.toBeDisabled();
        return button!;
      });

      await act(async () => {
        fireEvent.pointerDown(edit);
        await Promise.resolve();
      });
      hover.remove();

      const editorHost = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!;
      expect(editorHost.parentElement).toBe(document.body);
      expect(sidebar.contains(editorHost)).toBe(false);
      expect(editorHost.dataset.placement).toBe('docked');
      expect(editorHost.shadowRoot).toHaveTextContent('Full Contexto editor');
      document.body.append(hover);
    } finally {
      act(() => {
        cleanup();
        controller.disconnect();
      });
    }
  });
});

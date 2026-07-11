import { describe, expect, it, vi } from 'vitest';
import { mountContextoSurface } from '@/src/x/mount-contexto-surface';
import { AccountDraftStore } from '@/src/x/draft-store';

vi.mock('@/src/ui/ContextoProfileSurface', () => ({
  ContextoProfileSurface: () => <div>Inline Contexto</div>,
}));

describe('mountContextoSurface', () => {
  it('mounts an isolated inline root and removes it during cleanup', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const cleanup = mountContextoSurface({
      surface: {
        kind: 'hover-card', host,
        profile: { platform: 'x', handle: 'theo', profileUrl: 'https://x.com/theo' },
      },
      send: vi.fn(), drafts: new AccountDraftStore(), css: '.contexto-surface{}', theme: 'dark',
    });
    const mountHost = host.querySelector<HTMLElement>('[data-contexto-surface="hover-card"]');
    expect(mountHost?.shadowRoot).not.toBeNull();
    expect(mountHost?.getAttribute('data-theme')).toBe('dark');
    cleanup();
    expect(host.querySelector('[data-contexto-surface]')).toBeNull();
  });
});

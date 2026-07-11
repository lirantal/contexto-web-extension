import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContextoProfileSurfaceProps } from '@/src/ui/ContextoProfileSurface';
import { AccountDraftStore } from '@/src/x/draft-store';
import { createPageEditorController } from '@/src/x/page-editor-controller';

describe('page editor controller with the real editor', () => {
  it('moves focus into the modal after its async editor becomes ready', async () => {
    document.body.innerHTML = '';
    const launcher = document.createElement('button');
    document.body.append(launcher);
    launcher.focus();
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: undefined }
      : { ok: true, lookups: { companies: [], tags: [], folders: [] } });
    const controller = createPageEditorController({
      root: document.body,
      send: send as ContextoProfileSurfaceProps['send'],
      drafts: new AccountDraftStore(),
      css: '',
    });

    controller.open({ platform: 'x', handle: 'theo', profileUrl: 'https://x.com/theo' }, launcher);
    const shadow = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!.shadowRoot!;

    await waitFor(() => {
      const close = shadow.querySelector('[aria-label="Close Contexto editor"]');
      expect(close).not.toBeNull();
      expect(shadow.activeElement).toBe(close);
    });
    controller.disconnect();
  });
});

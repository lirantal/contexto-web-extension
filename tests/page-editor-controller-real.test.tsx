import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContextoProfileSurfaceProps } from '@/src/ui/ContextoProfileSurface';
import type { ContextoResponse } from '@/src/shared/messages';
import { AccountDraftStore } from '@/src/x/draft-store';
import { createPageEditorController } from '@/src/x/page-editor-controller';

describe('page editor controller with the real editor', () => {
  it('moves focus once after delayed modal content becomes ready', async () => {
    document.body.innerHTML = '';
    const launcher = document.createElement('button');
    document.body.append(launcher);
    launcher.focus();
    let resolveLookup!: (response: ContextoResponse) => void;
    const lookup = new Promise<ContextoResponse>((resolve) => { resolveLookup = resolve; });
    const send = vi.fn((message) => message.type === 'contexto:account:lookup'
      ? lookup
      : Promise.resolve({ ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } } as ContextoResponse));
    const controller = createPageEditorController({
      root: document.body,
      send: send as ContextoProfileSurfaceProps['send'],
      drafts: new AccountDraftStore(),
      css: '',
    });

    controller.open({ platform: 'x', handle: 'theo', profileUrl: 'https://x.com/theo' }, launcher);
    const shadow = document.querySelector<HTMLElement>('[data-contexto-page-editor]')!.shadowRoot!;
    expect(shadow.activeElement).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(shadow.activeElement).toBeNull();
    resolveLookup({ ok: true, lookup: true, lookupAccount: undefined });
    await waitFor(() => {
      const firstControl = shadow.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
      expect(firstControl).not.toBeNull();
      expect(shadow.activeElement).toBe(firstControl);
    });

    const roleLabel = Array.from(shadow.querySelectorAll('label')).find((label) => label.textContent === 'Role')!;
    const role = shadow.getElementById(roleLabel.htmlFor)!;
    role?.focus();
    document.body.append(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(shadow.activeElement).toBe(role);
    controller.disconnect();
  });
});

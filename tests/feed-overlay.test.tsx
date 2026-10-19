import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mountContextoSurface } from '@/src/x/mount-contexto-surface';
import { AccountDraftStore } from '@/src/x/draft-store';
import type { AccountSummary } from '@/src/shared/types';

const css = readFileSync(resolve('src/ui/contexto-profile-surface.css'), 'utf8');
const fixture = readFileSync(resolve('tests/fixtures/x/feed-post-quote-card.html'), 'utf8');
const profile = { platform: 'x' as const, handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo' };
const account: AccountSummary = {
  ...profile, id: 'account_1', normalizedHandle: 'theo', tags: [], folders: [],
  syncState: 'local-only', createdAt: '2026-07-12', updatedAt: '2026-07-12',
};

describe('feed relationship overlay', () => {
  it.each(['light', 'dark'] as const)('portals outside the quoted post in %s theme and cleans up with the marker', async (theme) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = fixture;
    const post = wrapper.firstElementChild as HTMLElement;
    // X may isolate and clip the entire post; the overlay must escape both.
    post.style.cssText = 'transform:translateY(0);isolation:isolate;overflow:hidden';
    document.body.append(wrapper);
    const navigate = vi.fn();
    post.addEventListener('click', navigate);
    const onEdit = vi.fn();
    const send = vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: account });
    let cleanup!: ReturnType<typeof mountContextoSurface>;
    act(() => {
      cleanup = mountContextoSurface({
        surface: { kind: 'feed-post', host: post, profile },
        send, drafts: new AccountDraftStore(), css, theme, openPageEditor: onEdit,
      });
    });
    try {
      const markerHost = post.querySelector<HTMLElement>('[data-contexto-surface="feed-post"]')!;
      const markerRoot = within(markerHost.shadowRoot as unknown as HTMLElement);
      const marker = await markerRoot.findByRole('button', { name: 'Contexto context for Theo' });
      const overlay = document.querySelector<HTMLElement>('[data-contexto-feed-overlay]')!;
      const overlayRoot = within(overlay.shadowRoot as unknown as HTMLElement);
      expect(overlay.parentElement).toBe(document.body);
      expect(overlay.dataset.theme).toBe(theme);
      expect(overlay.shadowRoot?.querySelector('style')?.textContent).toBe(css);
      expect(overlayRoot.queryByRole('dialog')).toBeNull();

      fireEvent.click(marker);
      const dialog = overlayRoot.getByRole('dialog', { name: 'Contexto relationship context' });
      expect(markerRoot.queryByRole('dialog')).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
      // Use composed events across the actual Shadow DOM boundary.
      fireEvent.pointerDown(overlayRoot.getByRole('button', { name: 'Add quick note' }), { composed: true });
      fireEvent.click(overlayRoot.getByRole('button', { name: 'Add quick note' }));
      expect(dialog).toBeInTheDocument();
      expect(overlay.shadowRoot?.activeElement).toBe(overlayRoot.getByRole('textbox', { name: 'Relationship note' }));
      fireEvent.change(overlayRoot.getByRole('textbox'), { target: { value: 'Unsaved note' } });
      fireEvent.click(overlayRoot.getByRole('button', { name: 'Close Contexto context' }));
      expect(overlayRoot.queryByRole('dialog')).toBeNull();
      expect(markerHost.shadowRoot?.activeElement).toBe(marker);

      fireEvent.click(marker);
      fireEvent.click(overlayRoot.getByRole('button', { name: 'Add quick note' }));
      expect(overlayRoot.getByRole('textbox')).toHaveValue('');
      fireEvent.keyDown(overlayRoot.getByRole('textbox'), { key: 'Escape', composed: true });
      expect(overlayRoot.queryByRole('dialog')).toBeNull();
      fireEvent.click(marker);
      fireEvent.pointerDown(document.body);
      expect(overlayRoot.queryByRole('dialog')).toBeNull();

      fireEvent.click(marker);
      fireEvent.click(overlayRoot.getByRole('button', { name: 'Edit tags and folders' }));
      const tagsInput = overlayRoot.getByRole('combobox', { name: 'Tags' });
      expect(overlay.shadowRoot?.activeElement).toBe(tagsInput);
      fireEvent.pointerDown(tagsInput, { composed: true });
      fireEvent.change(tagsInput, { target: { value: 'Unsaved tag' } });
      expect(overlayRoot.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(overlayRoot.getByRole('button', { name: 'Cancel' }));
      expect(overlayRoot.queryByRole('combobox', { name: 'Tags' })).toBeNull();
      expect(overlayRoot.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(overlayRoot.getByRole('button', { name: 'Open full context' }));
      expect(onEdit).toHaveBeenCalledWith(profile, marker);
      expect(overlayRoot.queryByRole('dialog')).toBeNull();
      fireEvent.click(marker);
    } finally {
      act(() => cleanup());
      wrapper.remove();
    }
    await waitFor(() => expect(document.querySelector('[data-contexto-feed-overlay]')).toBeNull());
    expect(post.querySelector('[data-contexto-surface="feed-post"]')).toBeNull();
  });
});

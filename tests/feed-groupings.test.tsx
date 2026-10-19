import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextoFeedContext } from '@/src/ui/ContextoFeedContext';
import type { AccountSummary } from '@/src/shared/types';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';

const profile = { platform: 'x' as const, handle: 'dev', displayName: 'Dev', profileUrl: 'https://x.com/dev' };
const tag = { id: 'tag_1', name: 'Security', normalizedName: 'security', createdAt: '', updatedAt: '' };
const folder = { ...tag, id: 'folder_1', name: 'Friends', normalizedName: 'friends' };
const account: AccountSummary = {
  ...profile, id: 'account_1', normalizedHandle: 'dev', syncState: 'local-only', createdAt: '', updatedAt: '',
  tags: [tag], folders: [folder],
};

async function setup(saveResponse: () => Promise<ContextoResponse>, lookupFails = false, empty = false) {
  const send = vi.fn(async (message: ContextoRequest): Promise<ContextoResponse> => {
    if (message.type === 'contexto:account:lookup') return { ok: true, lookup: true, lookupAccount: empty ? { ...account, tags: [], folders: [] } : account };
    if (message.type === 'contexto:lookups:list') {
      if (lookupFails) throw new Error('Suggestions unavailable');
      const lookups = { tags: [tag, { ...tag, id: 'tag_2', name: 'OSS' }], folders: [folder], companies: [], roles: [], locations: [] };
      return { ok: true, lookups };
    }
    if (message.type === 'contexto:account:saveGroupings') return saveResponse();
    return { ok: false, error: 'Unavailable' };
  });
  const user = userEvent.setup();
  render(<ContextoFeedContext profile={profile} send={send} onEdit={vi.fn()} />);
  const marker = await screen.findByRole('button', { name: 'Contexto context for Dev' });
  await user.click(marker);
  await user.click(screen.getByRole('button', { name: 'Edit tags and folders' }));
  return { user, send, marker };
}

describe('feed tag and folder editing', () => {
  it('selects suggestions, removes assignments, and saves pending text without changing other metadata', async () => {
    const { user, send } = await setup(async () => ({ ok: true, account: { ...account, tags: [{ ...tag, name: 'OSS' }], folders: [{ ...folder, name: 'Speakers' }] } }));
    expect(screen.getByRole('combobox', { name: 'Tags' })).toHaveFocus();
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'contexto:account:saveGroupings' }));
    await user.click(screen.getByRole('button', { name: 'Remove Security from Tags' }));
    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'OS');
    await user.click(await screen.findByRole('option', { name: 'OSS' }));
    await user.click(screen.getByRole('button', { name: 'Remove Friends from Folders' }));
    await user.type(screen.getByRole('combobox', { name: 'Folders' }), ' Speakers ');
    await user.click(screen.getByRole('button', { name: 'Save tags and folders' }));
    expect(send).toHaveBeenCalledWith({ type: 'contexto:account:saveGroupings', accountId: account.id, tagNames: ['OSS'], folderNames: ['Speakers'] });
    expect(await screen.findByText('Tags and folders saved')).toBeVisible();
    expect(within(screen.getByTestId('contexto-feed-tags')).getByText('OSS')).toBeVisible();
    expect(within(screen.getByTestId('contexto-feed-folders')).getByText('Speakers')).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('supports empty assignments and free-text creation when suggestions fail', async () => {
    const { user, send } = await setup(async () => ({ ok: true, account }), true, true);
    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'New tag{Enter}');
    await user.type(screen.getByRole('combobox', { name: 'Folders' }), 'New folder');
    await user.click(screen.getByRole('button', { name: 'Save tags and folders' }));
    expect(send).toHaveBeenCalledWith({ type: 'contexto:account:saveGroupings', accountId: account.id, tagNames: ['New tag'], folderNames: ['New folder'] });
  });

  it('keeps failed drafts for retry and discards them on Cancel or panel dismissal', async () => {
    const { user, marker } = await setup(async () => ({ ok: false, error: 'Storage unavailable' }));
    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'Retry me');
    await user.click(screen.getByRole('button', { name: 'Save tags and folders' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable');
    expect(screen.getByRole('combobox', { name: 'Tags' })).toHaveValue('Retry me');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Edit tags and folders' }));
    expect(screen.getByRole('combobox', { name: 'Tags' })).toHaveValue('');
    await user.type(screen.getByRole('combobox', { name: 'Folders' }), 'Discard me');
    await user.click(marker);
    await user.click(marker);
    await user.click(screen.getByRole('button', { name: 'Edit tags and folders' }));
    expect(screen.getByRole('combobox', { name: 'Folders' })).toHaveValue('');
  });

  it('disables controls while saving and ignores a response after the panel closes', async () => {
    let resolveSave!: (response: ContextoResponse) => void;
    const pending = new Promise<ContextoResponse>((resolve) => { resolveSave = resolve; });
    const { user, marker } = await setup(() => pending);
    await user.click(screen.getByRole('button', { name: 'Save tags and folders' }));
    expect(screen.getByRole('combobox', { name: 'Tags' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Folders' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    fireEvent.pointerDown(document.body);
    await act(async () => resolveSave({ ok: true, account: { ...account, displayName: 'Stale response' } }));
    await user.click(marker);
    expect(screen.getByText('Dev')).toBeVisible();
    expect(screen.queryByText('Stale response')).not.toBeInTheDocument();
  });
});

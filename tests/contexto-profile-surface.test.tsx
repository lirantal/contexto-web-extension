import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextoProfileSurface, type ContextoProfileSurfaceProps } from '@/src/ui/ContextoProfileSurface';
import { AccountDraftStore } from '@/src/x/draft-store';

const profile = {
  platform: 'x' as const,
  handle: 'theo',
  displayName: 'Theo – t3.gg',
  profileUrl: 'https://x.com/theo',
  location: 'San Francisco',
};

function renderSurface(send: ReturnType<typeof vi.fn>) {
  return render(<ContextoProfileSurface profile={profile} kind="hover-card"
    send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);
}

describe('ContextoProfileSurface', () => {
  it('shows the complete prefilled editor without saving an unknown account', async () => {
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: undefined }
      : { ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } });
    renderSurface(send);
    expect(await screen.findByLabelText('Display name')).toHaveValue('Theo – t3.gg');
    expect(screen.getByLabelText('X handle')).toHaveValue('@theo');
    expect(screen.getByLabelText('Role')).toBeVisible();
    expect(screen.queryByLabelText('Position')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Profession')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Company')).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveValue('San Francisco');
    expect(screen.getByLabelText('How you know them')).toBeVisible();
    expect(screen.getByLabelText('Tags')).toBeVisible();
    expect(screen.getByLabelText('Folders')).toBeVisible();
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'contexto:account:saveContext' }));
  });

  it('fuzzy-selects and saves an existing location', async () => {
    const saved = {
      id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo',
      displayName: 'Theo – t3.gg', profileUrl: 'https://x.com/theo',
      location: 'San Francisco', tags: [], folders: [],
    };
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({
        ok: true,
        lookups: { companies: [], tags: [], folders: [], locations: ['San Francisco'] },
      })
      .mockResolvedValueOnce({ ok: true, account: saved });

    renderSurface(send);
    const location = await screen.findByLabelText('Location');
    fireEvent.change(location, { target: { value: 'sfr' } });
    fireEvent.click(screen.getByRole('option', { name: 'San Francisco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));

    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:account:saveContext',
      input: expect.objectContaining({
        metadata: expect.objectContaining({ location: 'San Francisco' }),
      }),
    })));
  });

  it('saves distinct tag and folder values and keeps the editor visible', async () => {
    const saved = {
      id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo',
      displayName: 'Theo Browne', profileUrl: 'https://x.com/theo', role: 'CEO',
      company: { id: 'company_1', name: 't3dotchat' },
      tags: [{ id: 'tag_1', name: 'Founder' }], folders: [{ id: 'folder_1', name: 'Friends' }],
    };
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } })
      .mockResolvedValueOnce({ ok: true, account: saved });
    renderSurface(send);
    fireEvent.change(await screen.findByLabelText('Display name'), { target: { value: 'Theo Browne' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'CEO' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 't3dotchat' } });
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'Founder' } });
    fireEvent.keyDown(screen.getByLabelText('Tags'), { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Folders'), { target: { value: 'Friends' } });
    fireEvent.keyDown(screen.getByLabelText('Folders'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:account:saveContext',
      input: expect.objectContaining({ tagNames: ['Founder'], folderNames: ['Friends'] }),
    })));
    expect(await screen.findByLabelText('Display name')).toHaveValue('Theo Browne');
    expect(screen.getByLabelText('Role')).toHaveValue('CEO');
    expect(screen.getByLabelText('Company')).toHaveValue('t3dotchat');
    expect(screen.getByText('Saved to Contexto')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeVisible();
  });

  it('retains the editor and exposes retry after a failed save', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } })
      .mockResolvedValue({ ok: false, error: 'Database unavailable' });
    renderSurface(send);
    fireEvent.click(await screen.findByRole('button', { name: 'Save to Contexto' }));
    expect(await screen.findByText('Database unavailable')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeVisible();
    expect(screen.getByLabelText('Display name')).toHaveValue('Theo – t3.gg');
  });

  it('recovers when the runtime rejects a save request', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } })
      .mockRejectedValueOnce(new Error('Extension unavailable'));
    renderSurface(send);
    fireEvent.click(await screen.findByRole('button', { name: 'Save to Contexto' }));
    expect(await screen.findByText('Extension unavailable')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled();
  });

  it('restores an existing-account edit after a transient remount', async () => {
    const drafts = new AccountDraftStore();
    const saved = { id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo', role: 'CTO', tags: [], folders: [] };
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: saved }
      : { ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } });
    const first = render(<ContextoProfileSurface profile={profile} kind="hover-card" send={send as ContextoProfileSurfaceProps['send']} drafts={drafts} />);
    fireEvent.change(await screen.findByLabelText('Role'), { target: { value: 'CEO' } });
    first.unmount();
    render(<ContextoProfileSurface profile={profile} kind="hover-card" send={send as ContextoProfileSurfaceProps['send']} drafts={drafts} />);
    expect(await screen.findByLabelText('Role')).toHaveValue('CEO');
  });

  it('retries a failed lookup without discarding the prefilled editor', async () => {
    let lookupAttempts = 0;
    const send = vi.fn(async (message) => {
      if (message.type === 'contexto:account:lookup') {
        lookupAttempts += 1;
        if (lookupAttempts === 1) throw new Error('Lookup unavailable');
        return { ok: true, lookup: true, lookupAccount: undefined };
      }
      return { ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } };
    });
    renderSurface(send);
    expect(await screen.findByText('Lookup unavailable')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry lookup' }));
    expect(await screen.findByLabelText('Display name')).toHaveValue('Theo – t3.gg');
    expect(screen.queryByText('Lookup unavailable')).not.toBeInTheDocument();
  });

  it('restores persisted values on cancel without hiding an inline editor', async () => {
    const saved = { id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo', role: 'CTO', tags: [], folders: [] };
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: saved }
      : { ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } });
    renderSurface(send);

    fireEvent.change(await screen.findByLabelText('Role'), { target: { value: 'CEO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByLabelText('Role')).toHaveValue('CTO');
    expect(screen.getByLabelText('Display name')).toBeVisible();
  });

  it('exposes modal dialog semantics for the fallback editor', async () => {
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: undefined }
      : { ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } });
    render(<ContextoProfileSurface profile={profile} kind="hover-card" placement="modal" send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contexto profile editor' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes through the request callback after a successful save', async () => {
    const onRequestClose = vi.fn();
    const saved = { id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo', tags: [], folders: [] };
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } })
      .mockResolvedValueOnce({ ok: true, account: saved });
    render(<ContextoProfileSurface profile={profile} kind="hover-card" placement="modal" onRequestClose={onRequestClose} send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save to Contexto' }));
    await waitFor(() => expect(onRequestClose).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: 'Close Contexto editor' })).not.toBeInTheDocument();
  });

  it('keeps a failed save open and closes only when Cancel is clicked', async () => {
    const drafts = new AccountDraftStore();
    const onRequestClose = vi.fn();
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], locations: [] } })
      .mockResolvedValueOnce({ ok: false, error: 'Database unavailable' });
    render(<ContextoProfileSurface profile={profile} kind="hover-card" placement="modal" onRequestClose={onRequestClose} send={send as ContextoProfileSurfaceProps['send']} drafts={drafts} />);

    fireEvent.change(await screen.findByLabelText('Role'), { target: { value: 'CEO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));
    expect(await screen.findByText('Database unavailable')).toBeVisible();
    expect(onRequestClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRequestClose).toHaveBeenCalledOnce();
    expect(drafts.get(profile.handle)).toBeUndefined();
  });
});

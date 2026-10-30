import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextoProfileSurface, type ContextoProfileSurfaceProps } from '@/src/ui/ContextoProfileSurface';
import { AccountDraftStore } from '@/src/x/draft-store';

const profile = {
  platform: 'x' as const,
  handle: 'theo',
  displayName: 'Theo – t3.gg',
  profileUrl: 'https://x.com/theo',
  location: 'San Francisco',
  website: 'https://arize.com/',
};

function renderSurface(send: ReturnType<typeof vi.fn>) {
  return render(<ContextoProfileSurface profile={profile} kind="hover-card"
    send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);
}

describe('ContextoProfileSurface', () => {
  it('groups editor fields by identity, work, and relationship', async () => {
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: undefined }
      : { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } });
    renderSurface(send);

    const editor = await screen.findByRole('region', { name: 'Contexto profile editor' });
    expect(within(editor).getByRole('group', { name: 'Identity' })).toContainElement(screen.getByLabelText('Display name'));
    expect(within(editor).getByRole('group', { name: 'Identity' })).toContainElement(screen.getByLabelText('Location'));
    expect(within(editor).getByRole('group', { name: 'Identity' })).toContainElement(screen.getByLabelText('Website'));
    expect(within(editor).getByRole('group', { name: 'Relationship' })).not.toContainElement(screen.getByLabelText('Location'));
    expect(within(editor).getByRole('group', { name: 'Work' })).toContainElement(screen.getByLabelText('Company'));
    expect(within(editor).getByRole('group', { name: 'Relationship' })).toContainElement(screen.getByLabelText('Tags'));
  });

  it('shows the complete prefilled editor without saving an unknown account', async () => {
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: undefined }
      : { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } });
    renderSurface(send);
    expect(await screen.findByLabelText('Display name')).toHaveValue('Theo – t3.gg');
    expect(screen.getByLabelText('X handle')).toHaveValue('@theo');
    expect(screen.getByLabelText('Role')).toBeVisible();
    expect(screen.queryByLabelText('Position')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Profession')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Company')).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveValue('San Francisco');
    expect(screen.getByLabelText('Website')).toHaveValue('https://arize.com/');
    expect(screen.getByLabelText('How you know them')).toBeVisible();
    expect(screen.getByLabelText('Tags')).toBeVisible();
    expect(screen.getByLabelText('Circles')).toBeVisible();
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'contexto:account:saveContext' }));
  });

  it.each([
    ['', '', 'San Francisco', 'https://arize.com/'],
    ['   ', '  ', 'San Francisco', 'https://arize.com/'],
    ['', 'https://saved.example/', 'San Francisco', 'https://saved.example/'],
    ['Berlin', '', 'Berlin', 'https://arize.com/'],
    ['Berlin', 'https://saved.example/', 'Berlin', 'https://saved.example/'],
  ])('prefills empty saved metadata independently (%j, %j)', async (location, website, expectedLocation, expectedWebsite) => {
    const saved = { ...profile, id: 'saved', location, website, tags: [], folders: [] };
    const send = vi.fn(async (message) => {
      if (message.type === 'contexto:account:lookup') return { ok: true, lookup: true, lookupAccount: saved };
      if (message.type === 'contexto:account:saveContext') return { ok: true, account: { ...saved, ...message.input.metadata } };
      return { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } };
    });
    render(<ContextoProfileSurface profile={profile} kind="full-profile"
      send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);
    expect(await screen.findByLabelText('Location')).toHaveValue(expectedLocation);
    expect(screen.getByLabelText('Website')).toHaveValue(expectedWebsite);
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'contexto:account:saveContext' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Saved to Contexto');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:account:saveContext',
      input: expect.objectContaining({ metadata: expect.objectContaining({ location: expectedLocation, website: expectedWebsite }) }),
    }));
  });

  it('keeps fields empty when neither the saved account nor X provides metadata', async () => {
    const saved = { ...profile, id: 'saved', location: '', website: '', tags: [], folders: [] };
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: saved }
      : { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } });
    render(<ContextoProfileSurface profile={{ ...profile, location: undefined, website: undefined }} kind="full-profile"
      send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);
    expect(await screen.findByLabelText('Location')).toHaveValue('');
    expect(screen.getByLabelText('Website')).toHaveValue('');
  });

  it('preserves cleared fields through remount and Save; Cancel restores persisted blanks', async () => {
    const drafts = new AccountDraftStore();
    const saved = { ...profile, id: 'saved', location: '', website: '', tags: [], folders: [] };
    const send = vi.fn(async (message) => {
      if (message.type === 'contexto:account:lookup') return { ok: true, lookup: true, lookupAccount: saved };
      if (message.type === 'contexto:account:saveContext') return { ok: true, account: saved };
      return { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } };
    });
    const props = { profile, kind: 'full-profile' as const, send: send as ContextoProfileSurfaceProps['send'], drafts };
    const first = render(<ContextoProfileSurface {...props} />);
    fireEvent.change(await screen.findByLabelText('Location'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: '' } });
    first.unmount();
    render(<ContextoProfileSurface {...props} />);
    expect(await screen.findByLabelText('Location')).toHaveValue('');
    expect(screen.getByLabelText('Website')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Saved to Contexto');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:account:saveContext',
      input: expect.objectContaining({ metadata: expect.objectContaining({ location: '', website: '' }) }),
    }));
    expect(screen.getByLabelText('Location')).toHaveValue('');
    expect(screen.getByLabelText('Website')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Discard' } });
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'https://discard.example/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Location')).toHaveValue('');
    expect(screen.getByLabelText('Website')).toHaveValue('');
  });

  it('saves an edited website and restores the saved website on Cancel', async () => {
    const saved = { ...profile, id: 'saved', website: 'https://saved.example/', tags: [], folders: [] };
    const send = vi.fn(async (message) => {
      if (message.type === 'contexto:account:lookup') return { ok: true, lookup: true, lookupAccount: saved };
      if (message.type === 'contexto:account:saveContext') return { ok: true, account: { ...saved, website: message.input.metadata.website } };
      return { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } };
    });
    renderSurface(send);
    const website = await screen.findByLabelText('Website');
    expect(website).toHaveValue('https://saved.example/');
    fireEvent.change(website, { target: { value: 'https://edited.example/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Saved to Contexto');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:account:saveContext',
      input: expect.objectContaining({ metadata: expect.objectContaining({ website: 'https://edited.example/' }) }),
    }));
    fireEvent.change(website, { target: { value: 'discard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(website).toHaveValue('https://edited.example/');
  });

  it('fuzzy-selects and saves an existing company', async () => {
    const saved = {
      id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo',
      displayName: 'Theo – t3.gg', profileUrl: 'https://x.com/theo',
      company: { id: 'company_1', name: 'OpenAI' }, tags: [], folders: [],
    };
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({
        ok: true,
        lookups: {
          companies: [{ id: 'company_1', name: 'OpenAI' }],
          tags: [],
          folders: [],
          roles: [],
          locations: [],
        },
      })
      .mockResolvedValueOnce({ ok: true, account: saved });

    renderSurface(send);
    const company = await screen.findByLabelText('Company');
    fireEvent.change(company, { target: { value: 'opi' } });
    fireEvent.click(screen.getByRole('option', { name: 'OpenAI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));

    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:account:saveContext',
      input: expect.objectContaining({
        metadata: expect.objectContaining({ companyName: 'OpenAI' }),
      }),
    })));
  });

  it.each(['inline', 'docked', 'modal'] as const)('suggests and saves roles in the %s editor', async (placement) => {
    const saved = { ...profile, id: 'saved', role: 'Founder', tags: [], folders: [] };
    const send = vi.fn(async (message) => {
      if (message.type === 'contexto:account:lookup') return { ok: true, lookup: true, lookupAccount: undefined };
      if (message.type === 'contexto:account:saveContext') return { ok: true, account: saved };
      return { ok: true, lookups: { companies: [], tags: [], folders: [], locations: [], roles: ['Founder'] } };
    });
    render(<ContextoProfileSurface profile={profile} kind="full-profile" placement={placement}
      send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);
    const role = await screen.findByRole('combobox', { name: 'Role' });
    fireEvent.change(role, { target: { value: 'fdr' } });
    expect(screen.getByRole('option', { name: 'Founder' })).toBeVisible();
    if (placement === 'modal') {
      fireEvent.click(screen.getByRole('option', { name: 'Founder' }));
    } else {
      fireEvent.keyDown(role, { key: 'ArrowDown' });
      fireEvent.keyDown(role, { key: 'Enter' });
    }
    expect(role).toHaveValue('Founder');
    fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:account:saveContext',
      input: expect.objectContaining({ metadata: expect.objectContaining({ role: 'Founder' }) }),
    })));
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
        lookups: { companies: [], tags: [], folders: [], roles: [], locations: ['San Francisco'] },
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
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } })
      .mockResolvedValueOnce({ ok: true, account: saved });
    renderSurface(send);
    fireEvent.change(await screen.findByLabelText('Display name'), { target: { value: 'Theo Browne' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'CEO' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 't3dotchat' } });
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'Founder' } });
    fireEvent.keyDown(screen.getByLabelText('Tags'), { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Circles'), { target: { value: 'Friends' } });
    fireEvent.keyDown(screen.getByLabelText('Circles'), { key: 'Enter' });
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

  it.each(['inline', 'docked', 'modal'] as const)('saves both pending inputs alongside chips in the %s editor', async (placement) => {
    const saved = {
      id: 'account_1', platform: 'x', handle: 'theo', displayName: 'Theo',
      profileUrl: 'https://x.com/theo',
      tags: [{ id: 't1', name: 'Founder' }, { id: 't2', name: 'speaker' }],
      folders: [{ id: 'f1', name: 'Friends' }, { id: 'f2', name: 'Conference' }],
    };
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } })
      .mockResolvedValueOnce({ ok: true, account: saved });
    const onRequestClose = vi.fn();
    render(<ContextoProfileSurface profile={profile} kind="full-profile" placement={placement}
      onRequestClose={placement === 'inline' ? undefined : onRequestClose}
      send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);
    const tags = await screen.findByLabelText('Tags');
    const folders = screen.getByLabelText('Circles');
    fireEvent.change(tags, { target: { value: 'Founder' } });
    fireEvent.keyDown(tags, { key: 'Enter' });
    fireEvent.change(folders, { target: { value: 'Friends' } });
    fireEvent.keyDown(folders, { key: 'Enter' });
    fireEvent.change(tags, { target: { value: '  speaker  ' } });
    fireEvent.change(folders, { target: { value: '  Conference  ' } });
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'contexto:account:saveContext' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith({
      type: 'contexto:account:saveContext',
      input: { profile, accountRevision: '', groupingRevision: undefined, metadata: expect.any(Object), tagNames: ['Founder', 'speaker'], folderNames: ['Friends', 'Conference'] },
    }));
    await screen.findByText('Saved to Contexto');
    expect(tags).toHaveValue('');
    expect(folders).toHaveValue('');
    expect(screen.getByText('speaker')).toBeVisible();
    expect(screen.getByText('Conference')).toBeVisible();
    expect(onRequestClose).toHaveBeenCalledTimes(placement === 'inline' ? 0 : 1);
  });

  it.each(['  ', '  FOUNDER  '])('ignores blank or duplicate pending values (%j)', async (query) => {
    const saved = { id: 'a1', handle: 'theo', displayName: 'Theo',
      tags: [{ id: 't1', name: 'Founder' }], folders: [{ id: 'f1', name: 'Founder' }] };
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: saved })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } })
      .mockResolvedValueOnce({ ok: true, account: saved });
    renderSurface(send);
    fireEvent.change(await screen.findByLabelText('Tags'), { target: { value: query } });
    fireEvent.change(screen.getByLabelText('Circles'), { target: { value: query } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:account:saveContext', input: expect.objectContaining({ tagNames: ['Founder'], folderNames: ['Founder'] }),
    })));
    await screen.findByText('Saved to Contexto');
  });

  it('preserves pending inputs through failed save, retry, and remount; Cancel clears them', async () => {
    const drafts = new AccountDraftStore();
    const send = vi.fn(async (message) => {
      if (message.type === 'contexto:account:lookup') return { ok: true, lookup: true, lookupAccount: undefined };
      if (message.type === 'contexto:lookups:list') return { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } };
      return { ok: false, error: 'Database unavailable' };
    });
    const props = { profile, kind: 'full-profile' as const, send: send as ContextoProfileSurfaceProps['send'], drafts };
    const first = render(<ContextoProfileSurface {...props} />);
    fireEvent.change(await screen.findByLabelText('Tags'), { target: { value: 'speaker' } });
    fireEvent.change(screen.getByLabelText('Circles'), { target: { value: 'Friends' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save to Contexto' }));
    await screen.findByText('Database unavailable');
    expect(screen.getByLabelText('Tags')).toHaveValue('speaker');
    expect(screen.getByLabelText('Circles')).toHaveValue('Friends');
    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
    await waitFor(() => expect(send.mock.calls.filter(([message]) => message.type === 'contexto:account:saveContext')).toHaveLength(2));
    await screen.findByText('Database unavailable');
    first.unmount();
    render(<ContextoProfileSurface {...props} />);
    expect(await screen.findByLabelText('Tags')).toHaveValue('speaker');
    expect(screen.getByLabelText('Circles')).toHaveValue('Friends');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Tags')).toHaveValue('');
    expect(screen.getByLabelText('Circles')).toHaveValue('');
    expect(drafts.get(profile.handle)).toBeUndefined();
  });

  it('retains the editor and exposes retry after a failed save', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } })
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
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } })
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
      : { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } });
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
      return { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } };
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
      : { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } });
    renderSurface(send);

    fireEvent.change(await screen.findByLabelText('Role'), { target: { value: 'CEO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByLabelText('Role')).toHaveValue('CTO');
    expect(screen.getByLabelText('Display name')).toBeVisible();
  });

  it('exposes modal dialog semantics for the fallback editor', async () => {
    const send = vi.fn(async (message) => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: undefined }
      : { ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } });
    render(<ContextoProfileSurface profile={profile} kind="hover-card" placement="modal" send={send as ContextoProfileSurfaceProps['send']} drafts={new AccountDraftStore()} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contexto profile editor' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes through the request callback after a successful save', async () => {
    const onRequestClose = vi.fn();
    const saved = { id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo', tags: [], folders: [] };
    const send = vi.fn()
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined })
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } })
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
      .mockResolvedValueOnce({ ok: true, lookups: { companies: [], tags: [], folders: [], roles: [], locations: [] } })
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

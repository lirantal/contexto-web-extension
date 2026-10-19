import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextoFeedContext } from '@/src/ui/ContextoFeedContext';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { AccountSummary, Bookmark, ProfileSnapshot, XPostSnapshot } from '@/src/shared/types';

const profile: ProfileSnapshot = {
  platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo',
};

const post: XPostSnapshot = {
  platform: 'x',
  authorHandle: 'theo',
  postId: '123',
  postUrl: 'https://x.com/theo/status/123',
  excerpt: 'A useful release update.',
};

const bookmarkRecord: Bookmark = {
  id: 'bookmark_1',
  accountId: 'account_1',
  platform: 'x',
  postId: '123',
  postUrl: 'https://x.com/theo/status/123',
  capturedAt: '2026-07-12T12:00:00.000Z',
  createdAt: '2026-07-12T12:00:00.000Z',
  updatedAt: '2026-07-12T12:00:00.000Z',
};

const saved: AccountSummary = {
  id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo', displayName: 'Theo Browne',
  profileUrl: 'https://x.com/theo', role: 'Developer', relationshipSource: 'Conference friend', syncState: 'local-only',
  createdAt: '2026-07-12', updatedAt: '2026-07-12',
  company: { id: 'company_1', name: 'Ping Labs', normalizedName: 'ping labs', createdAt: '2026-07-12', updatedAt: '2026-07-12' },
  tags: [{ id: 'tag_1', name: 'Security', normalizedName: 'security', createdAt: '2026-07-12', updatedAt: '2026-07-12' }],
  folders: [{ id: 'folder_1', name: 'DevRel friends', normalizedName: 'devrel friends', createdAt: '2026-07-12', updatedAt: '2026-07-12' }],
  latestNote: { id: 'note_1', accountId: 'account_1', body: 'Invite Theo to the security roundtable.', source: 'manual', createdAt: '2026-07-12', updatedAt: '2026-07-12' },
};

function renderFeed(account: AccountSummary | null = saved, onEdit = vi.fn()) {
  const send = vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: account ?? undefined });
  render(<ContextoFeedContext profile={profile} send={send} onEdit={onEdit} />);
  return { send, onEdit };
}

function renderCapturable(
  bookmark: Bookmark | undefined = undefined,
  captureResponse: ContextoResponse = { ok: true, bookmark: bookmarkRecord },
) {
  const send = vi.fn(async (message: ContextoRequest): Promise<ContextoResponse> => {
    if (message.type === 'contexto:account:lookup') {
      return { ok: true, lookup: true, lookupAccount: saved };
    }
    if (message.type === 'contexto:bookmark:lookup') {
      return { ok: true, bookmarkLookup: true, lookupBookmark: bookmark };
    }
    return captureResponse;
  });
  render(<ContextoFeedContext profile={profile} post={post} send={send} onEdit={vi.fn()} />);
  return send;
}

function renderWithSettings(settingsResponse: ContextoResponse | Error) {
  const send = vi.fn(async (message: ContextoRequest): Promise<ContextoResponse> => {
    if (message.type === 'contexto:account:lookup') {
      return { ok: true, lookup: true, lookupAccount: saved };
    }
    if (message.type === 'contexto:settings:get') {
      if (settingsResponse instanceof Error) throw settingsResponse;
      return settingsResponse;
    }
    if (message.type === 'contexto:bookmark:lookup') {
      return { ok: true, bookmarkLookup: true, lookupBookmark: undefined };
    }
    return { ok: false, error: 'Unexpected request' };
  });
  render(<ContextoFeedContext profile={profile} post={post} send={send} onEdit={vi.fn()} />);
  return send;
}

function renderQuickNote(noteResponse: ContextoResponse | Promise<ContextoResponse>) {
  const send = vi.fn(async (message: ContextoRequest): Promise<ContextoResponse> => {
    if (message.type === 'contexto:account:lookup') {
      return { ok: true, lookup: true, lookupAccount: saved };
    }
    if (message.type === 'contexto:settings:get') {
      return { ok: true, settings: { myXHandle: '', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false } };
    }
    if (message.type === 'contexto:note:add') {
      return noteResponse;
    }
    return { ok: false, error: 'Unexpected request' };
  });
  render(<ContextoFeedContext profile={profile} send={send} onEdit={vi.fn()} />);
  return send;
}

describe('ContextoFeedContext', () => {
  it('shows saved context and opens the existing editor from the marker', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderFeed();
    const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
    expect(marker).toHaveAttribute('aria-expanded', 'false');
    await user.click(marker);
    const panel = screen.getByRole('dialog', { name: 'Contexto relationship context' });
    expect(within(panel).getByText('Saved context')).toBeVisible();
    expect(within(panel).getByText('Add to Contexto')).toBeVisible();
    expect(within(panel).getByText('Theo Browne')).toBeVisible();
    expect(within(panel).getByText('Role:')).toBeVisible();
    expect(within(panel).getByText('Developer')).toBeVisible();
    expect(within(panel).getByText('Company:')).toBeVisible();
    expect(within(panel).getByText('Ping Labs')).toBeVisible();
    expect(within(panel).getByText('How you know them:')).toBeVisible();
    expect(within(panel).getByText('Conference friend')).toBeVisible();
    expect(within(panel).getByText('Tags:')).toBeVisible();
    expect(within(panel).getByText('Folders:')).toBeVisible();
    expect(within(panel).getByText('Latest note:')).toBeVisible();
    expect(within(panel).getByText('Invite Theo to the security roundtable.')).toBeVisible();
    expect(within(panel).queryByText('Developer · Ping Labs')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open full context' }));
    expect(onEdit).toHaveBeenCalledWith(profile, marker);
  });

  it('opens the panel without triggering the enclosing feed post navigation', async () => {
    const user = userEvent.setup();
    const navigateToPost = vi.fn();
    const send = vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved });

    render(
      <article onClick={navigateToPost}>
        <ContextoFeedContext profile={profile} send={send} onEdit={vi.fn()} />
      </article>,
    );

    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

    expect(screen.getByRole('dialog', { name: 'Contexto relationship context' })).toBeVisible();
    expect(navigateToPost).not.toHaveBeenCalled();
  });

  it('omits empty optional metadata and keeps the feed summary read-only', async () => {
    const account = { ...saved, role: undefined, relationshipSource: undefined, company: undefined, tags: [], folders: [], latestNote: undefined, displayName: 'Theo' };
    renderFeed(account);
    const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
    await userEvent.click(marker);
    expect(screen.getByText('Theo')).toBeVisible();
    expect(screen.queryByText('Role:')).not.toBeInTheDocument();
    expect(screen.queryByText('Company:')).not.toBeInTheDocument();
    expect(screen.queryByText('How you know them:')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags:')).not.toBeInTheDocument();
    expect(screen.queryByText('Folders:')).not.toBeInTheDocument();
    expect(screen.queryByText('Latest note:')).not.toBeInTheDocument();
    expect(screen.queryByText(/Developer/)).not.toBeInTheDocument();
    expect(screen.queryByText('Conference friend')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('omits empty and whitespace-only imported metadata without orphan labels', async () => {
    const account: AccountSummary = {
      ...saved,
      role: '',
      relationshipSource: '\t',
      company: { ...saved.company!, name: '   ' },
      tags: [
        { ...saved.tags[0], id: 'tag_empty', name: '' },
        { ...saved.tags[0], id: 'tag_whitespace', name: ' \n ' },
      ],
      folders: [
        { ...saved.folders[0], id: 'folder_empty', name: '' },
        { ...saved.folders[0], id: 'folder_whitespace', name: '\t' },
      ],
      latestNote: { ...saved.latestNote!, body: '  ' },
    };
    renderFeed(account);

    await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

    expect(screen.queryByTestId('contexto-feed-role')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-feed-company')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-feed-relationship')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-feed-tags')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-feed-folders')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-feed-note')).not.toBeInTheDocument();
  });

  it('preserves original nonblank metadata text while filtering blank collection names', async () => {
    const account: AccountSummary = {
      ...saved,
      role: '  Developer  ',
      relationshipSource: '  Conference friend  ',
      company: { ...saved.company!, name: '  Ping Labs  ' },
      tags: [
        { ...saved.tags[0], id: 'tag_blank', name: '   ' },
        { ...saved.tags[0], id: 'tag_meaningful', name: '  Security  ' },
      ],
      folders: [
        { ...saved.folders[0], id: 'folder_blank', name: '' },
        { ...saved.folders[0], id: 'folder_meaningful', name: '  DevRel friends  ' },
      ],
      latestNote: { ...saved.latestNote!, body: '  Follow up soon.  ' },
    };
    renderFeed(account);

    await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

    expect(within(screen.getByTestId('contexto-feed-role')).getByText('Developer').textContent)
      .toBe('  Developer  ');
    expect(within(screen.getByTestId('contexto-feed-company')).getByText('Ping Labs').textContent)
      .toBe('  Ping Labs  ');
    expect(within(screen.getByTestId('contexto-feed-relationship')).getByText('Conference friend').textContent)
      .toBe('  Conference friend  ');
    expect(within(screen.getByTestId('contexto-feed-tags')).getByText('Security').textContent)
      .toBe('  Security  ');
    expect(screen.getByTestId('contexto-feed-tags').querySelectorAll('.chip')).toHaveLength(1);
    expect(within(screen.getByTestId('contexto-feed-folders')).getByText('DevRel friends').textContent)
      .toBe('  DevRel friends  ');
    expect(screen.getByTestId('contexto-feed-folders').querySelectorAll('.folder-chip')).toHaveLength(1);
    expect(within(screen.getByTestId('contexto-feed-note')).getByText('Follow up soon.').textContent)
      .toBe('  Follow up soon.  ');
  });

  it('renders no UI for unsaved or failed local lookups', async () => {
    cleanup();
    const { send } = renderFeed(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /Contexto context/i })).not.toBeInTheDocument();
    expect(send).toHaveBeenCalledWith({ type: 'contexto:account:lookup', platform: 'x', handle: 'theo' });

    cleanup();
    const failingSend = vi.fn().mockRejectedValue(new Error('Runtime unavailable'));
    render(<ContextoFeedContext profile={profile} send={failingSend} onEdit={vi.fn()} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /Contexto context/i })).not.toBeInTheDocument();
  });

  it('closes on outside pointer or Escape but retains interaction inside the panel', async () => {
    const user = userEvent.setup();
    renderFeed();
    const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
    await user.click(marker);
    const panel = screen.getByRole('dialog', { name: 'Contexto relationship context' });
    await user.click(screen.getByText('Conference friend'));
    expect(panel).toBeVisible();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Contexto relationship context' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Contexto relationship context' })).not.toBeInTheDocument();
  });

  it('adds a quick relationship note and refreshes the latest saved context', async () => {
    const user = userEvent.setup();
    const updated = {
      ...saved,
      latestNote: {
        id: 'note_2',
        accountId: saved.id,
        body: 'Follow up after the launch.',
        source: 'manual' as const,
        createdAt: '2026-07-16T12:00:00.000Z',
        updatedAt: '2026-07-16T12:00:00.000Z',
      },
    };
    const send = renderQuickNote({ ok: true, account: updated });

    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'contexto:note:add' }));
    await user.click(screen.getByRole('button', { name: 'Add quick note' }));
    const note = screen.getByRole('textbox', { name: 'Relationship note' });
    expect(note).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();

    await user.type(note, '  Follow up after the launch.  ');
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    expect(send).toHaveBeenCalledWith({
      type: 'contexto:note:add',
      accountId: saved.id,
      body: '  Follow up after the launch.  ',
    });
    expect(await screen.findByText('Note saved')).toBeVisible();
    expect(screen.getByTestId('contexto-feed-note')).toHaveTextContent('Follow up after the launch.');
    expect(screen.queryByRole('textbox', { name: 'Relationship note' })).not.toBeInTheDocument();
  });

  it('preserves a failed quick note for retry and clears drafts on Cancel or panel close', async () => {
    const user = userEvent.setup();
    renderQuickNote({ ok: false, error: 'Could not save note' });
    const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
    await user.click(marker);
    await user.click(screen.getByRole('button', { name: 'Add quick note' }));
    const note = screen.getByRole('textbox', { name: 'Relationship note' });
    await user.type(note, 'Remember the beta feedback');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save note');
    expect(note).toHaveValue('Remember the beta feedback');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Add quick note' }));
    expect(screen.getByRole('textbox', { name: 'Relationship note' })).toHaveValue('');
    await user.type(screen.getByRole('textbox', { name: 'Relationship note' }), 'Discard me');
    await user.click(marker);
    await user.click(marker);
    await user.click(screen.getByRole('button', { name: 'Add quick note' }));
    expect(screen.getByRole('textbox', { name: 'Relationship note' })).toHaveValue('');
  });

  it('disables the quick-note composer while Save is pending', async () => {
    let resolveNote!: (response: ContextoResponse) => void;
    const pendingNote = new Promise<ContextoResponse>((resolve) => { resolveNote = resolve; });
    const updated = {
      ...saved,
      latestNote: {
        id: 'note_2', accountId: saved.id, body: 'Pending note', source: 'manual' as const,
        createdAt: '2026-07-16T12:00:00.000Z', updatedAt: '2026-07-16T12:00:00.000Z',
      },
    };
    renderQuickNote(pendingNote);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    await user.click(screen.getByRole('button', { name: 'Add quick note' }));
    await user.type(screen.getByRole('textbox', { name: 'Relationship note' }), 'Pending note');
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    expect(screen.getByRole('button', { name: 'Saving note…' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Relationship note' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    resolveNote({ ok: true, account: updated });
    expect(await screen.findByText('Note saved')).toBeVisible();
  });

  it('keeps quick-note and bookmark drafts mutually exclusive', async () => {
    renderCapturable();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

    await user.click(screen.getByRole('button', { name: 'Add quick note' }));
    expect(screen.queryByRole('button', { name: 'Capture this post' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Capture this post' }));
    expect(screen.queryByRole('button', { name: 'Add quick note' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Why are you saving this? (optional)' }))
      .toBeVisible();
  });

  it('replaces a saved bookmark action row with the quick-note composer', async () => {
    renderCapturable(bookmarkRecord);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

    const localActions = screen.getByText('Add to Contexto').closest('section')!;
    expect(within(localActions).getByRole('button', { name: 'Bookmarked' })).toBeDisabled();
    expect(localActions.querySelector('.contexto-feed-action-row')).toBeInTheDocument();

    await user.click(within(localActions).getByRole('button', { name: 'Add quick note' }));

    expect(within(localActions).getByRole('textbox', { name: 'Relationship note' })).toBeVisible();
    expect(within(localActions).queryByRole('button', { name: 'Bookmarked' })).not.toBeInTheDocument();
    expect(localActions.querySelector('.contexto-feed-action-row')).not.toBeInTheDocument();
  });

  it('opens a safe two-way X interaction search when my handle is configured', async () => {
    renderWithSettings({
      ok: true,
      settings: { myXHandle: '@Liran_Tal', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false },
    });

    await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    const link = await screen.findByRole('link', { name: 'View our interactions' });
    const url = new URL(link.getAttribute('href')!);

    expect(url.searchParams.get('q')).toBe('(from:liran_tal to:theo) OR (from:theo to:liran_tal)');
    expect(url.searchParams.get('f')).toBe('live');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('groups outbound X links together before the catch-up checkpoint', async () => {
    renderWithSettings({
      ok: true,
      settings: { myXHandle: '@liran_tal', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false },
    });

    await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    const explore = screen.getByRole('group', { name: 'Explore on X' });
    const links = within(explore).getAllByRole('link');
    const checkpoint = within(explore).getByTestId('contexto-feed-checkpoint');

    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining('Catch up on X'),
      expect.stringContaining('View our interactions'),
    ]);
    expect(links[1].compareDocumentPosition(checkpoint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens posts since the checkpoint and advances it only when explicitly marked', async () => {
    const user = userEvent.setup();
    const checkpointed = { ...saved, lastCatchUpAt: '2026-07-10T18:42:00.000Z' };
    const advanced = { ...checkpointed, lastCatchUpAt: '2026-07-16T10:15:00.000Z' };
    const send = vi.fn(async (message: ContextoRequest): Promise<ContextoResponse> => {
      if (message.type === 'contexto:account:lookup') {
        return { ok: true, lookup: true, lookupAccount: checkpointed };
      }
      if (message.type === 'contexto:settings:get') {
        return { ok: true, settings: { myXHandle: '', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false } };
      }
      if (message.type === 'contexto:account:markCaughtUp') {
        return { ok: true, account: advanced };
      }
      return { ok: false, error: 'Unexpected request' };
    });
    render(<ContextoFeedContext profile={profile} send={send} onEdit={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    const link = screen.getByRole('link', { name: 'Catch up on X' });
    expect(new URL(link.getAttribute('href')!).searchParams.get('q'))
      .toBe('from:theo since:2026-07-10');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(send).not.toHaveBeenCalledWith({
      type: 'contexto:account:markCaughtUp', accountId: 'account_1',
    });
    expect(screen.getByText(/Last caught up/).closest('time'))
      .toHaveAttribute('datetime', checkpointed.lastCatchUpAt);

    await user.click(screen.getByRole('button', { name: 'Mark caught up' }));

    expect(send).toHaveBeenCalledWith({
      type: 'contexto:account:markCaughtUp', accountId: 'account_1',
    });
    expect(await screen.findByText('Catch-up checkpoint updated')).toBeVisible();
    expect(screen.getByText(/Last caught up/).closest('time'))
      .toHaveAttribute('datetime', advanced.lastCatchUpAt);
  });

  it('offers a complete author search before the first catch-up checkpoint', async () => {
    renderFeed();
    await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

    const link = screen.getByRole('link', { name: 'Catch up on X' });
    expect(new URL(link.getAttribute('href')!).searchParams.get('q')).toBe('from:theo');
    expect(screen.getByText('No catch-up checkpoint yet')).toBeVisible();
  });

  it('keeps the previous checkpoint and saved context when marking caught up fails', async () => {
    const user = userEvent.setup();
    const checkpointed = { ...saved, lastCatchUpAt: '2026-07-10T18:42:00.000Z' };
    const send = vi.fn(async (message: ContextoRequest): Promise<ContextoResponse> => {
      if (message.type === 'contexto:account:lookup') {
        return { ok: true, lookup: true, lookupAccount: checkpointed };
      }
      if (message.type === 'contexto:settings:get') {
        return { ok: true, settings: { myXHandle: '', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false } };
      }
      if (message.type === 'contexto:account:markCaughtUp') {
        return { ok: false, error: 'Checkpoint unavailable' };
      }
      return { ok: false, error: 'Unexpected request' };
    });
    render(<ContextoFeedContext profile={profile} send={send} onEdit={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    await user.click(screen.getByRole('button', { name: 'Mark caught up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Checkpoint unavailable');
    expect(screen.getByText(/Last caught up/).closest('time'))
      .toHaveAttribute('datetime', checkpointed.lastCatchUpAt);
    expect(screen.getByText('Conference friend')).toBeVisible();
  });

  it.each([
    ['missing', { ok: true, settings: { myXHandle: '', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false } }],
    ['invalid', { ok: true, settings: { myXHandle: 'not-valid!', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false } }],
    ['unsuccessful', { ok: false, error: 'Settings unavailable' }],
  ] as const)('hides the shortcut for %s settings without hiding saved context', async (_name, response) => {
    cleanup();
    renderWithSettings(response as ContextoResponse);
    await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    expect(screen.queryByRole('link', { name: 'View our interactions' })).not.toBeInTheDocument();
    expect(screen.getByText('Conference friend')).toBeVisible();
  });

  it('keeps saved context and bookmark capture available when settings reject', async () => {
    renderWithSettings(new Error('Settings unavailable'));
    await userEvent.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));

    expect(screen.queryByRole('link', { name: 'View our interactions' })).not.toBeInTheDocument();
    expect(screen.getByText('Conference friend')).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Capture this post' })).toBeVisible();
  });

  it('captures a post with an optional reminder and becomes bookmarked', async () => {
    const user = userEvent.setup();
    const send = renderCapturable();
    const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
    await user.click(marker);
    await user.click(await screen.findByRole('button', { name: 'Capture this post' }));
    const reminder = screen.getByRole('textbox', { name: 'Why are you saving this? (optional)' });
    expect(reminder).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Save bookmark' }));

    expect(send).toHaveBeenCalledWith({
      type: 'contexto:bookmark:capture',
      accountId: 'account_1',
      authorHandle: 'theo',
      postUrl: 'https://x.com/theo/status/123',
      excerpt: 'A useful release update.',
      reminder: '',
    });
    expect(await screen.findByText('Bookmark saved')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Bookmarked' })).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: /Why are you saving/ })).not.toBeInTheDocument();
  });

  it('shows duplicate state and hides capture when bookmark eligibility is unavailable', async () => {
    const user = userEvent.setup();
    renderCapturable({ ...bookmarkRecord, id: 'bookmark_existing' });
    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    expect(await screen.findByRole('button', { name: 'Bookmarked' })).toBeDisabled();

    cleanup();
    const failingSend = vi.fn(async (message: ContextoRequest): Promise<ContextoResponse> => message.type === 'contexto:account:lookup'
      ? { ok: true, lookup: true, lookupAccount: saved }
      : { ok: false, error: 'Bookmark lookup unavailable' });
    render(<ContextoFeedContext profile={profile} post={post} send={failingSend} onEdit={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: 'Capture this post' })).not.toBeInTheDocument();
    expect(screen.getByText('Theo Browne')).toBeVisible();
  });

  it('preserves a failed reminder for retry and clears drafts on cancel or panel close', async () => {
    const user = userEvent.setup();
    renderCapturable(undefined, { ok: false, error: 'Could not save bookmark' });
    const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
    await user.click(marker);
    await user.click(await screen.findByRole('button', { name: 'Capture this post' }));
    const reminder = screen.getByRole('textbox', { name: 'Why are you saving this? (optional)' });
    await user.type(reminder, 'Possible podcast guest');
    await user.click(screen.getByRole('button', { name: 'Save bookmark' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save bookmark');
    expect(reminder).toHaveValue('Possible podcast guest');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Capture this post' }));
    expect(screen.getByRole('textbox', { name: /Why are you saving/ })).toHaveValue('');
    await user.type(screen.getByRole('textbox', { name: /Why are you saving/ }), 'Discard me');
    await user.click(marker);
    await user.click(marker);
    await user.click(screen.getByRole('button', { name: 'Capture this post' }));
    expect(screen.getByRole('textbox', { name: /Why are you saving/ })).toHaveValue('');
  });

  it('disables the composer while bookmark capture is pending', async () => {
    let resolveCapture!: (value: ContextoResponse) => void;
    const capture = new Promise<ContextoResponse>((resolve) => { resolveCapture = resolve; });
    const send = vi.fn((message: ContextoRequest): Promise<ContextoResponse> => {
      if (message.type === 'contexto:account:lookup') {
        return Promise.resolve({ ok: true, lookup: true, lookupAccount: saved });
      }
      if (message.type === 'contexto:bookmark:lookup') {
        return Promise.resolve({ ok: true, bookmarkLookup: true, lookupBookmark: undefined });
      }
      return capture;
    });
    render(<ContextoFeedContext profile={profile} post={post} send={send} onEdit={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    await user.click(await screen.findByRole('button', { name: 'Capture this post' }));
    await user.click(screen.getByRole('button', { name: 'Save bookmark' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /Why are you saving/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    resolveCapture({ ok: true, bookmark: bookmarkRecord });
    expect(await screen.findByRole('button', { name: 'Bookmarked' })).toBeDisabled();
  });

  it('limits reminders by Unicode code points rather than UTF-16 units', async () => {
    renderCapturable();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Contexto context for Theo/i }));
    await user.click(await screen.findByRole('button', { name: 'Capture this post' }));
    const reminder = screen.getByRole('textbox', { name: 'Why are you saving this? (optional)' });

    expect(reminder).not.toHaveAttribute('maxlength');
    fireEvent.change(reminder, { target: { value: '😀'.repeat(501) } });
    expect([...String((reminder as HTMLTextAreaElement).value)]).toHaveLength(500);
  });
});

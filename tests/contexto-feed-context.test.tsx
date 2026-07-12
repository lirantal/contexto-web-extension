import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('ContextoFeedContext', () => {
  it('shows saved context and opens the existing editor from the marker', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderFeed();
    const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
    expect(marker).toHaveAttribute('aria-expanded', 'false');
    await user.click(marker);
    expect(screen.getByText('Theo Browne')).toBeVisible();
    expect(screen.getByText('Developer · Ping Labs')).toBeVisible();
    expect(screen.getByText('Conference friend')).toBeVisible();
    expect(screen.getByText('Invite Theo to the security roundtable.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open full context' }));
    expect(onEdit).toHaveBeenCalledWith(profile, marker);
  });

  it('omits empty optional metadata and keeps the feed summary read-only', async () => {
    const account = { ...saved, role: undefined, relationshipSource: undefined, company: undefined, tags: [], folders: [], latestNote: undefined, displayName: 'Theo' };
    renderFeed(account);
    const marker = await screen.findByRole('button', { name: /Contexto context for Theo/i });
    await userEvent.click(marker);
    expect(screen.getByText('Theo')).toBeVisible();
    expect(screen.queryByText(/Developer/)).not.toBeInTheDocument();
    expect(screen.queryByText('Conference friend')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
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
});

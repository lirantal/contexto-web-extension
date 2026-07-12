import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextoFeedContext } from '@/src/ui/ContextoFeedContext';
import type { AccountSummary, ProfileSnapshot } from '@/src/shared/types';

const profile: ProfileSnapshot = {
  platform: 'x', handle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo',
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

function renderFeed(account: AccountSummary | undefined = saved, onEdit = vi.fn()) {
  const send = vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: account ?? undefined });
  render(<ContextoFeedContext profile={profile} send={send} onEdit={onEdit} />);
  return { send, onEdit };
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
});

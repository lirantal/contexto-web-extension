import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextoHoverLauncher, type ContextoHoverLauncherProps } from '@/src/ui/ContextoHoverLauncher';

const profile = {
  platform: 'x' as const,
  handle: 'theo',
  displayName: 'Theo',
  profileUrl: 'https://x.com/theo',
};

function renderLauncher(send: ReturnType<typeof vi.fn>, onEdit = vi.fn()) {
  render(<ContextoHoverLauncher profile={profile} send={send as ContextoHoverLauncherProps['send']} onEdit={onEdit} />);
  return onEdit;
}

describe('ContextoHoverLauncher', () => {
  it('shows a compact unsaved status and opens the page editor', async () => {
    const user = userEvent.setup();
    const onEdit = renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: undefined }));

    expect(await screen.findByText('Not saved')).toBeVisible();
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();

    const edit = screen.getByRole('button', { name: 'Edit' });
    await user.click(edit);
    expect(onEdit).toHaveBeenCalledWith(profile, edit);
  });

  it('shows saved display name and populated role, company, tags, and circles', async () => {
    const saved = {
      id: 'account_1', platform: 'x' as const, handle: 'theo', normalizedHandle: 'theo',
      displayName: 'Theo Browne', profileUrl: 'https://x.com/theo',
      role: 'Developer', company: { id: 'company_1', name: 'Ping Labs', normalizedName: 'ping labs', updatedAt: '2026-07-12' },
      tags: [
        { id: 'tag_1', name: 'Founder', normalizedName: 'founder', updatedAt: '2026-07-12' },
        { id: 'tag_2', name: 'Security', normalizedName: 'security', updatedAt: '2026-07-12' },
      ],
      folders: [
        { id: 'circle_1', name: 'Friends', normalizedName: 'friends', updatedAt: '2026-07-12' },
        { id: 'circle_2', name: 'Colleagues', normalizedName: 'colleagues', updatedAt: '2026-07-12' },
      ],
    };
    renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved }));

    expect(await screen.findByText('Saved')).toBeVisible();
    expect(screen.getByText('Theo Browne')).toBeVisible();
    expect(screen.getByText('Role:')).toBeVisible();
    expect(screen.getByText('Developer')).toBeVisible();
    expect(screen.getByText('Company:')).toBeVisible();
    expect(screen.getByText('Ping Labs')).toBeVisible();
    expect(screen.getByText('Tags:')).toBeVisible();
    expect(screen.getByText('Founder')).toBeVisible();
    expect(screen.getByText('Security')).toBeVisible();
    expect(screen.getByText('Circles:')).toBeVisible();
    expect(screen.getByText('Friends')).toBeVisible();
    expect(screen.getByText('Colleagues')).toBeVisible();
    expect(screen.getByText('Friends')).toHaveClass('contexto-hover-tag', 'folder-chip');
    expect(screen.queryByText('Developer · Ping Labs')).not.toBeInTheDocument();
  });

  it('omits empty optional metadata from a saved summary', async () => {
    const saved = {
      id: 'account_1', platform: 'x' as const, handle: 'theo', normalizedHandle: 'theo',
      displayName: 'Theo', profileUrl: 'https://x.com/theo', tags: [], folders: [],
    };
    renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved }));

    expect(await screen.findByText('Theo')).toBeVisible();
    expect(screen.queryByText('Role:')).not.toBeInTheDocument();
    expect(screen.queryByText('Company:')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags:')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-hover-role')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-hover-company')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-hover-tags')).not.toBeInTheDocument();
    expect(screen.queryByText('Circles:')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-hover-circles')).not.toBeInTheDocument();
  });

  it('omits empty and whitespace-only imported metadata without orphan labels', async () => {
    const saved = {
      id: 'account_1', platform: 'x' as const, handle: 'theo', normalizedHandle: 'theo',
      displayName: 'Theo', profileUrl: 'https://x.com/theo', role: '',
      company: { id: 'company_1', name: '  ', normalizedName: '', updatedAt: '2026-07-12' },
      tags: [
        { id: 'tag_1', name: '', normalizedName: '', updatedAt: '2026-07-12' },
        { id: 'tag_2', name: '\t', normalizedName: '', updatedAt: '2026-07-12' },
      ],
      folders: [
        { id: 'circle_1', name: '', normalizedName: '', updatedAt: '2026-07-12' },
        { id: 'circle_2', name: '\t', normalizedName: '', updatedAt: '2026-07-12' },
      ],
    };
    renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved }));

    expect(await screen.findByText('Theo')).toBeVisible();
    expect(screen.queryByTestId('contexto-hover-role')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-hover-company')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-hover-tags')).not.toBeInTheDocument();
    expect(screen.queryByText('Circles:')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contexto-hover-circles')).not.toBeInTheDocument();
  });

  it('preserves original nonblank metadata text while filtering blank tag and circle names', async () => {
    const saved = {
      id: 'account_1', platform: 'x' as const, handle: 'theo', normalizedHandle: 'theo',
      displayName: 'Theo', profileUrl: 'https://x.com/theo', role: '  Developer  ',
      company: { id: 'company_1', name: '  Ping Labs  ', normalizedName: 'ping labs', updatedAt: '2026-07-12' },
      tags: [
        { id: 'tag_1', name: ' ', normalizedName: '', updatedAt: '2026-07-12' },
        { id: 'tag_2', name: '  Security  ', normalizedName: 'security', updatedAt: '2026-07-12' },
      ],
      folders: [
        { id: 'circle_1', name: ' ', normalizedName: '', updatedAt: '2026-07-12' },
        { id: 'circle_2', name: '  Friends  ', normalizedName: 'friends', updatedAt: '2026-07-12' },
      ],
    };
    renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved }));

    expect(await screen.findByText('Theo')).toBeVisible();
    expect(screen.getByTestId('contexto-hover-role').querySelector('.contexto-metadata-value')?.textContent)
      .toBe('  Developer  ');
    expect(screen.getByTestId('contexto-hover-company').querySelector('.contexto-metadata-value')?.textContent)
      .toBe('  Ping Labs  ');
    expect(screen.getByTestId('contexto-hover-tags').querySelector('.contexto-hover-tag')?.textContent)
      .toBe('  Security  ');
    expect(screen.getByTestId('contexto-hover-tags').querySelectorAll('.contexto-hover-tag'))
      .toHaveLength(1);
    expect(screen.getByTestId('contexto-hover-circles').querySelector('.contexto-hover-tag')?.textContent)
      .toBe('  Friends  ');
    expect(screen.getByTestId('contexto-hover-circles').querySelectorAll('.contexto-hover-tag'))
      .toHaveLength(1);
  });

  it('opens on pointer-down without relying on pointerType before X can remove the hover card', async () => {
    const onEdit = renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: undefined }));
    const edit = await screen.findByRole('button', { name: 'Edit' });

    fireEvent.pointerDown(edit);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('does not duplicate pointer activation with its subsequent click', async () => {
    const onEdit = renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: undefined }));
    const edit = await screen.findByRole('button', { name: 'Edit' });

    fireEvent.pointerDown(edit);
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('keeps click activation for keyboard users', async () => {
    const onEdit = renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: undefined }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('offers a compact retry when lookup fails', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('Runtime unavailable'))
      .mockResolvedValueOnce({ ok: true, lookup: true, lookupAccount: undefined });
    renderLauncher(send);

    expect(await screen.findByText('Contexto unavailable')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Not saved')).toBeVisible();
    expect(send).toHaveBeenCalledTimes(2);
  });
});

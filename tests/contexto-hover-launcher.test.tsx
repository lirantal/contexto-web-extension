import React from 'react';
import { render, screen } from '@testing-library/react';
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

  it('shows saved status without expanding the account metadata', async () => {
    const saved = { id: 'account_1', platform: 'x', handle: 'theo', normalizedHandle: 'theo', displayName: 'Theo', profileUrl: 'https://x.com/theo', tags: [], folders: [] };
    renderLauncher(vi.fn().mockResolvedValue({ ok: true, lookup: true, lookupAccount: saved }));

    expect(await screen.findByText('Saved')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(screen.queryByLabelText('Position')).not.toBeInTheDocument();
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

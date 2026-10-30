import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/src/data/db';
import { listManagedData, manageData } from '@/src/data/data-management';
import { listManagedGroupings, manageGrouping } from '@/src/data/grouping-management';
import { getAccountByHandle, getLookups, resetDatabaseForTests, saveAccountContext, saveAccountGroupings } from '@/src/data/repositories';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import { ContextoProfileSurface } from '@/src/ui/ContextoProfileSurface';
import { FeedGroupingsEditor } from '@/src/ui/FeedGroupingsEditor';
import { AccountDraftStore } from '@/src/x/draft-store';

const profile = { platform: 'x' as const, handle: 'dev', profileUrl: 'https://x.com/dev' };
afterEach(async () => { cleanup(); await resetDatabaseForTests(db); });
async function send(message: ContextoRequest): Promise<ContextoResponse> {
  try {
    if (message.type === 'contexto:account:lookup') return { ok: true, lookup: true, lookupAccount: await getAccountByHandle('x', message.handle) };
    if (message.type === 'contexto:lookups:list') return { ok: true, lookups: await getLookups() };
    if (message.type === 'contexto:account:saveContext') return { ok: true, account: await saveAccountContext(message.input) };
    if (message.type === 'contexto:account:saveGroupings') return { ok: true, account: await saveAccountGroupings(message.accountId, message.tagNames, message.folderNames, db, message.groupingRevision, message.accountRevision) };
    throw new Error('Unexpected message');
  } catch (error) { return { ok: false, error: (error as Error).message }; }
}

it('preserves stale profile drafts through remount, rejects saves, and explicitly reloads current values', async () => {
  await saveAccountContext({ profile, metadata: {}, tagNames: ['Typo'], folderNames: [] });
  const user = userEvent.setup();
  const drafts = new AccountDraftStore();
  const close = vi.fn();
  const props = { profile, kind: 'full-profile' as const, send, drafts, onRequestClose: close };
  const mounted = render(<ContextoProfileSurface {...props} />);
  await user.type(await screen.findByLabelText('Role'), 'Unsaved role');
  const catalog = await listManagedGroupings('tag');
  await manageGrouping('tag', catalog.items[0].id, { type: 'delete' }, catalog.revision);
  mounted.unmount();
  render(<ContextoProfileSurface {...props} />);
  expect(await screen.findByLabelText('Role')).toHaveValue('Unsaved role');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Shared data changed');
  expect(screen.getByLabelText('Role')).toHaveValue('Unsaved role');
  expect(close).not.toHaveBeenCalled();
  expect(await db.tags.count()).toBe(0);
  expect((await getAccountByHandle('x', 'dev'))!.role).toBeUndefined();
  await user.click(screen.getByRole('button', { name: 'Reload saved values' }));
  expect(await screen.findByLabelText('Role')).toHaveValue('');
  expect(screen.queryByRole('button', { name: 'Remove Typo from Tags' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Saved to Contexto');
  expect(close).toHaveBeenCalledOnce();
  expect(await db.tags.count()).toBe(0);
});

it('blocks stale feed folders and allows an explicit reload and successful retry', async () => {
  const account = await saveAccountContext({ profile, metadata: {}, tagNames: [], folderNames: ['Typo'] });
  const user = userEvent.setup();
  const saved = vi.fn();
  render(<FeedGroupingsEditor account={account} send={send} onSaved={saved} onCancel={vi.fn()} />);
  const catalog = await listManagedGroupings('folder');
  await manageGrouping('folder', catalog.items[0].id, { type: 'rename', name: 'Fixed' }, catalog.revision);
  await user.click(await screen.findByRole('button', { name: 'Save tags and circles' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Shared data changed');
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Remove Typo from Circles' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Reload saved values' }));
  expect(await screen.findByRole('button', { name: 'Remove Fixed from Circles' })).toBeVisible();
  await user.click(await screen.findByRole('button', { name: 'Save tags and circles' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(expect.objectContaining({ folders: [expect.objectContaining({ name: 'Fixed' })] })));
  expect(await db.folders.count()).toBe(1);
});

it('keeps the loaded catalog revision when cancelling an unsaved inline contact', async () => {
  await saveAccountContext({ profile, metadata: {}, tagNames: ['Typo'], folderNames: [] });
  const catalog = await listManagedGroupings('tag');
  await manageGrouping('tag', catalog.items[0].id, { type: 'rename', name: 'Fixed' }, catalog.revision);
  const user = userEvent.setup();
  render(<ContextoProfileSurface profile={{ platform: 'x', handle: 'newcontact', profileUrl: 'https://x.com/newcontact' }}
    kind="full-profile" send={send} drafts={new AccountDraftStore()} />);
  await user.type(await screen.findByLabelText('Role'), 'Discard');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Save to Contexto' }));
  expect(await screen.findByText('Saved to Contexto')).toBeVisible();
  expect((await getAccountByHandle('x', 'newcontact'))!.role).toBe('');
});

it.each(['company', 'role', 'location'] as const)('keeps stale X %s drafts open until current metadata is reloaded', async (kind) => {
  const account = await saveAccountContext({ profile, metadata: { companyName: 'Typo Co', role: 'Old role', location: 'Old place' }, tagNames: [], folderNames: [] });
  const user = userEvent.setup();
  const close = vi.fn();
  render(<ContextoProfileSurface profile={{ ...profile, location: kind === 'location' ? 'Old place' : undefined }} kind="full-profile" send={send} drafts={new AccountDraftStore()} onRequestClose={close} />);
  await user.type(await screen.findByLabelText('Display name'), ' unsaved');
  const catalog = await listManagedData(kind);
  await manageData(kind, kind === 'company' ? account.companyId! : kind === 'role' ? 'old role' : 'old place',
    kind === 'role' ? { type: 'replace', value: 'Correct role' } : kind === 'company' ? { type: 'delete' } : { type: 'clear' }, catalog.revision);
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Shared data changed');
  expect(screen.getByLabelText('Display name')).toHaveValue('dev unsaved');
  expect(close).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Reload saved values' }));
  expect(await screen.findByLabelText('Display name')).toHaveValue('dev');
  expect(screen.getByLabelText(kind === 'company' ? 'Company' : kind === 'role' ? 'Role' : 'Location')).toHaveValue(kind === 'role' ? 'Correct role' : '');
  if (kind === 'location') {
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Location')).toHaveValue('');
    expect(close).toHaveBeenCalledOnce();
    close.mockClear();
  }
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Saved to Contexto');
  expect(close).toHaveBeenCalledOnce();
  if (kind === 'company') expect(await db.companies.count()).toBe(0);
});

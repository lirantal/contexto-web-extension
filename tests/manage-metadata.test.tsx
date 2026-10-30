import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/src/data/db';
import * as management from '@/src/data/data-management';
import { ensureAccountFromProfile, getAccountSummary, resetDatabaseForTests, updateAccount } from '@/src/data/repositories';
import { ManageData } from '@/src/ui/ManageData';

afterEach(async () => { cleanup(); vi.restoreAllMocks(); await resetDatabaseForTests(db); });
async function seed(handle: string, companyName: string, role = '', location = '') {
  const account = await ensureAccountFromProfile({ platform: 'x', handle, profileUrl: `https://x.com/${handle}` });
  return updateAccount(account.id, { companyName, role, location });
}
async function setupCompanies() {
  const first = await seed('first', 'Typo');
  const second = await seed('second', 'Correct');
  const third = await seed('third', 'Unused');
  await updateAccount(third.id, { companyName: '' });
  const user = userEvent.setup();
  render(<ManageData onBack={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Companies' }));
  await screen.findByRole('button', { name: 'Rename Typo' });
  return { user, first, second };
}

it('searches companies, previews usage, filters unused records, and renames everywhere', async () => {
  const { user, first } = await setupCompanies();
  await user.click(screen.getByRole('button', { name: 'View contacts for Typo' }));
  expect(within(screen.getByRole('region', { name: 'view company' })).getByText('@first')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close preview' }));
  await user.click(screen.getByRole('checkbox', { name: 'Unused only' }));
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Unused');
  await user.click(screen.getByRole('checkbox', { name: 'Unused only' }));
  await user.type(screen.getByLabelText('Search companies'), 'ty');
  expect(screen.queryByRole('button', { name: 'Rename Correct' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Rename Typo' }));
  await user.clear(screen.getByLabelText('New name'));
  await user.type(screen.getByLabelText('New name'), 'Fixed');
  await user.click(screen.getByRole('button', { name: 'Rename everywhere' }));
  await screen.findByText('Value renamed everywhere.');
  expect((await getAccountSummary(first.id))!.company!.name).toBe('Fixed');
});

it('offers merging for company-name collisions and reassigns contacts to the destination', async () => {
  const { user, first, second } = await setupCompanies();
  await user.click(screen.getByRole('button', { name: 'Rename Typo' }));
  await user.clear(screen.getByLabelText('New name'));
  await user.type(screen.getByLabelText('New name'), 'Correct');
  expect(screen.getByRole('button', { name: 'Rename everywhere' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Merge into Correct' }));
  expect(screen.getByText(/Keep “Correct” for 2 contacts/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Merge values' }));
  await screen.findByText('Values merged. The source value was removed.');
  expect((await getAccountSummary(first.id))!.companyId).toBe(second.companyId);
  expect(await db.companies.get(first.companyId!)).toBeUndefined();
});

it('requires company deletion confirmation and cancellation leaves references intact', async () => {
  const { user, first } = await setupCompanies();
  await user.click(screen.getByRole('button', { name: 'Delete Typo' }));
  expect(screen.getByText(/Permanently delete company/)).toHaveTextContent('Their company field will be empty.');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect((await getAccountSummary(first.id))!.companyId).toBe(first.companyId);
  await user.click(screen.getByRole('button', { name: 'Delete Typo' }));
  await user.click(screen.getByRole('button', { name: 'Delete company everywhere' }));
  await screen.findByText('Company deleted. Contact company fields cleared.');
  expect((await getAccountSummary(first.id))!.companyId).toBeUndefined();
  expect(await getAccountSummary(first.id)).toBeDefined();
});

for (const field of ['role', 'location'] as const) {
  const tab = field === 'role' ? 'Roles' : 'Locations';
  async function setupText() {
    const first = await seed('first', 'Acme', field === 'role' ? 'Typo' : 'Engineer', field === 'location' ? 'Typo' : 'Berlin');
    const second = await seed('second', 'Acme');
    await db.accounts.update(second.id, { [field]: ' typo ' });
    const third = await seed('third', 'Acme');
    await db.accounts.update(third.id, { [field]: 'Correct' });
    const user = userEvent.setup();
    render(<ManageData onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: tab }));
    await screen.findByRole('button', { name: 'Replace Typo' });
    return { user, first, second, third };
  }

  it(`replaces ${field} variants with an existing value after previewing contacts`, async () => {
    const { user, first, second, third } = await setupText();
    expect(screen.queryByRole('checkbox', { name: 'Unused only' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Replace Typo' }));
    const preview = screen.getByRole('region', { name: `replace ${field}` });
    expect(within(preview).getByText('2 contacts affected.')).toBeVisible();
    expect(within(preview).getByText('@first')).toBeVisible();
    expect(within(preview).getByText('@second')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Replace everywhere' })).toBeDisabled();
    await user.type(screen.getByLabelText('Replacement value'), 'Correct');
    await user.click(screen.getByRole('button', { name: 'Replace everywhere' }));
    await screen.findByText('Value replaced on all matching contacts.');
    for (const account of [first, second, third]) expect((await getAccountSummary(account.id))![field]).toBe('Correct');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Replace Typo' })).not.toBeInTheDocument());
  });

  it(`confirms clearing ${field}, permits Cancel, and preserves unrelated values`, async () => {
    const { user, first, second, third } = await setupText();
    await user.click(screen.getByRole('button', { name: 'Clear Typo' }));
    expect(screen.getByText(new RegExp(`Clear ${field} “Typo”`))).toHaveTextContent('2 matching contacts');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((await getAccountSummary(first.id))![field]).toBe('Typo');
    await user.click(screen.getByRole('button', { name: 'Clear Typo' }));
    await user.click(screen.getByRole('button', { name: 'Clear everywhere' }));
    await screen.findByText('Value cleared from all matching contacts.');
    for (const account of [first, second]) expect((await getAccountSummary(account.id))![field]).toBeUndefined();
    expect((await getAccountSummary(third.id))![field]).toBe('Correct');
  });
}

it('retains failed replacement drafts, disables pending controls, and allows retry', async () => {
  await seed('first', 'Acme', 'Typo');
  const user = userEvent.setup();
  render(<ManageData onBack={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Roles' }));
  await user.click(await screen.findByRole('button', { name: 'Replace Typo' }));
  await user.type(screen.getByLabelText('Replacement value'), 'Correct');
  let reject!: (error: Error) => void;
  vi.spyOn(management, 'manageData').mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  await user.click(screen.getByRole('button', { name: 'Replace everywhere' }));
  expect(screen.getByLabelText('Replacement value')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  reject(new Error('Storage unavailable'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable');
  expect(screen.getByLabelText('Replacement value')).toHaveValue('Correct');
  await user.click(screen.getByRole('button', { name: 'Replace everywhere' }));
  await screen.findByText('Value replaced on all matching contacts.');
});

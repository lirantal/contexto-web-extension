import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/src/data/db';
import * as management from '@/src/data/grouping-management';
import { assignFolder, assignTag, ensureAccountFromProfile, getAccountSummary, removeTag, removeFolder, resetDatabaseForTests } from '@/src/data/repositories';
import { ManageData } from '@/src/ui/ManageData';

afterEach(async () => { cleanup(); vi.restoreAllMocks(); await resetDatabaseForTests(db); });
async function seed(kind: management.GroupingKind) {
  const first = await ensureAccountFromProfile({ platform: 'x', handle: 'first', profileUrl: 'https://x.com/first' });
  const second = await ensureAccountFromProfile({ platform: 'x', handle: 'second', profileUrl: 'https://x.com/second' });
  const assign = kind === 'tag' ? assignTag : assignFolder;
  await assign(first.id, 'Typo');
  await assign(second.id, 'Typo');
  await assign(second.id, 'Correct');
  const withUnused = await assign(first.id, 'Unused');
  if (kind === 'tag') await removeTag(first.id, withUnused.tags.find((t) => t.name === 'Unused')!.id);
  else await removeFolder(first.id, withUnused.folders.find((t) => t.name === 'Unused')!.id);
  return { first, second };
}
async function setup(kind: management.GroupingKind) {
  const contacts = await seed(kind);
  const user = userEvent.setup();
  const onBack = vi.fn();
  render(<ManageData onBack={onBack} />);
  if (kind === 'folder') await user.click(screen.getByRole('button', { name: 'Circles' }));
  await screen.findByRole('button', { name: 'Delete Typo' });
  return { ...contacts, user, onBack };
}

for (const kind of ['tag', 'folder'] as const) describe(`Manage ${kind === 'folder' ? 'circles' : 'tags'}`, () => {
  const singular = kind === 'folder' ? 'circle' : kind;
  const plural = kind === 'folder' ? 'circles' : 'tags';
  it('searches, filters unused values, sorts by usage, and previews affected contacts', async () => {
    const { user, onBack } = await setup(kind);
    await user.click(screen.getByRole('button', { name: 'View contacts for Typo' }));
    const preview = screen.getByRole('region', { name: `view ${singular}` });
    expect(within(preview).getByText('2 contacts using this value.')).toBeVisible();
    expect(within(preview).getByText('@first')).toBeVisible();
    expect(within(preview).getByText('@second')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close preview' }));
    await user.selectOptions(screen.getByLabelText('Sort by'), 'usage');
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Typo');
    await user.click(screen.getByRole('checkbox', { name: 'Unused only' }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Unused');
    await user.type(screen.getByLabelText(`Search ${plural}`), 'absent');
    expect(screen.getByText(/No values match/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to accounts' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renames a value everywhere and offers merging for a name collision', async () => {
    const { user, first } = await setup(kind);
    await user.click(screen.getByRole('button', { name: 'Rename Typo' }));
    await user.clear(screen.getByLabelText('New name'));
    await user.type(screen.getByLabelText('New name'), ' CORRECT ');
    expect(screen.getByRole('button', { name: 'Rename everywhere' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Merge into Correct' })).toBeVisible();
    await user.clear(screen.getByLabelText('New name'));
    await user.type(screen.getByLabelText('New name'), 'Fixed');
    await user.click(screen.getByRole('button', { name: 'Rename everywhere' }));
    await screen.findByText('Value renamed everywhere.');
    expect(await screen.findByRole('button', { name: 'Rename Fixed' })).toBeVisible();
    const summary = (await getAccountSummary(first.id))!;
    expect((kind === 'tag' ? summary.tags : summary.folders).map((v) => v.name)).toEqual(['Fixed']);
  });

  it('merges into an existing destination and deduplicates overlapping contacts', async () => {
    const { user, first, second } = await setup(kind);
    await user.click(screen.getByRole('button', { name: 'Rename Typo' }));
    await user.clear(screen.getByLabelText('New name'));
    await user.type(screen.getByLabelText('New name'), 'Correct');
    await user.click(screen.getByRole('button', { name: 'Merge into Correct' }));
    expect((screen.getByRole('option', { name: 'Correct' }) as HTMLOptionElement).selected).toBe(true);
    expect(screen.getByText(/Keep “Correct” for 2 contacts/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Merge values' }));
    await screen.findByText('Values merged. The source value was removed.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rename Typo' })).not.toBeInTheDocument());
    for (const contact of [first, second]) {
      const summary = (await getAccountSummary(contact.id))!;
      expect((kind === 'tag' ? summary.tags : summary.folders).map((v) => v.name)).toEqual(['Correct']);
    }
  });

  it('requires confirmation, permits Cancel, and deletes only the chosen value and assignments', async () => {
    const { user, first, second } = await setup(kind);
    await user.click(screen.getByRole('button', { name: 'Delete Typo' }));
    expect(screen.getByText(/Permanently delete/)).toHaveTextContent('all 2 contacts');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((await management.listManagedGroupings(kind)).items.some((i) => i.name === 'Typo')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Delete Typo' }));
    await user.click(screen.getByRole('button', { name: `Delete ${singular} everywhere` }));
    await screen.findByText('Value and all its assignments deleted.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Typo' })).not.toBeInTheDocument());
    expect(await getAccountSummary(first.id)).toBeDefined();
    const summary = (await getAccountSummary(second.id))!;
    expect((kind === 'tag' ? summary.tags : summary.folders).map((v) => v.name)).toEqual(['Correct']);
  });
});

it('retains the confirmation and error after a failed write and disables pending controls', async () => {
  const { user } = await setup('tag');
  let reject!: (reason: Error) => void;
  vi.spyOn(management, 'manageGrouping').mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  await user.click(screen.getByRole('button', { name: 'Delete Typo' }));
  await user.click(screen.getByRole('button', { name: 'Delete tag everywhere' }));
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  reject(new Error('Storage unavailable'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable');
  expect(screen.getByRole('button', { name: 'Delete tag everywhere' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Delete tag everywhere' }));
  await screen.findByText('Value and all its assignments deleted.');
});

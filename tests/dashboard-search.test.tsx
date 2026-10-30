import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/src/data/db';
import { listManagedData, manageData } from '@/src/data/data-management';
import { listManagedGroupings, manageGrouping } from '@/src/data/grouping-management';
import { getAccountSummary, listAccountSummaries, resetDatabaseForTests, saveAccountContext } from '@/src/data/repositories';
import { Dashboard } from '@/src/ui/Dashboard';

vi.mock('@/src/shared/settings', () => ({
  defaultSettings: { myXHandle: '', showNativeXSidebarWidgets: false },
  normalizeContextoSettings: (value: unknown) => value,
  settingsItem: { getValue: async () => ({ myXHandle: '', showNativeXSidebarWidgets: false }) },
  clearTargetHandleHistory: vi.fn(),
}));

async function seed(handle: string, tags: string[], folders: string[], companyName = 'Acme') {
  return saveAccountContext({
    profile: { platform: 'x', handle, displayName: handle, profileUrl: `https://x.com/${handle}` },
    metadata: { companyName }, tagNames: tags, folderNames: folders,
  });
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(async () => {
  cleanup();
  await resetDatabaseForTests(db);
});

describe('dashboard AND search', () => {
  it('filters viewer-specific relationships and audience ranges, including zero', async () => {
    const yes = await seed('yesuser', [], []);
    const no = await seed('nouser', [], []);
    await seed('unknownuser', [], []);
    await db.accounts.update(yes.id, { followsYou: true, followsYouViewerHandle: 'viewer', followersCount: 100, followingCount: 10 });
    await db.accounts.update(no.id, { followsYou: false, followsYouViewerHandle: 'viewer', followersCount: 0, followingCount: 0 });
    const user = userEvent.setup();
    render(<Dashboard settingsPersistence={{ updateSettings: vi.fn() }} />);
    const results = screen.getByRole('region', { name: 'Accounts' });
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(3));
    await user.type(screen.getByLabelText('My X handle'), 'viewer');
    await user.selectOptions(screen.getByLabelText('Follows you', { selector: 'select' }), 'yes');
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(1));
    expect(within(results).getByRole('button', { name: /@yesuser/ })).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Follows you', { selector: 'select' }), 'no');
    await waitFor(() => expect(within(results).getByRole('button', { name: /@nouser/ })).toBeVisible());
    await user.click(within(results).getByRole('button', { name: /@nouser/ }));
    const details = screen.getByRole('region', { name: 'Contact record details' });
    await waitFor(() => expect(within(details).getByText('No', { exact: true })).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.type(screen.getByLabelText('Followers maximum'), '0');
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(1));
    expect(within(results).getByRole('button', { name: /@nouser/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.selectOptions(screen.getByLabelText('Follows you', { selector: 'select' }), 'unknown');
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(1));
    expect(within(results).getByRole('button', { name: /@unknownuser/ })).toBeVisible();
  });

  it('discards deleted filter IDs after a catalog edit in another dashboard', async () => {
    await seed('filtered', ['Typo'], []);
    await seed('unfiltered', [], []);
    const user = userEvent.setup();
    render(<Dashboard settingsPersistence={{ updateSettings: vi.fn() }} />);
    await user.click(screen.getByText('Tags', { selector: 'summary' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Typo' }));
    const results = screen.getByRole('region', { name: 'Accounts' });
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(1));
    const catalog = await listManagedGroupings('tag');
    await manageGrouping('tag', catalog.items[0].id, { type: 'delete' }, catalog.revision);
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Remove Typo from Tags filters' })).not.toBeInTheDocument();
  });

  it('opens Manage data and returns to current contact results', async () => {
    await seed('managed', ['Example'], []);
    const user = userEvent.setup();
    render(<Dashboard settingsPersistence={{ updateSettings: vi.fn() }} />);
    await user.click(screen.getByRole('button', { name: 'Manage data' }));
    expect(await screen.findByRole('heading', { name: 'Manage data' })).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Rename Example' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to accounts' }));
    expect(await within(screen.getByRole('region', { name: 'Accounts' })).findByRole('button', { name: /@managed/ })).toBeVisible();
  });

  it('shows contact dates and supplied X identity only in dashboard record details', async () => {
    const account = await seed('dated', [], []);
    const createdAt = '2025-01-02T03:04:05.000Z';
    const updatedAt = '2026-02-03T04:05:06.000Z';
    await db.accounts.update(account.id, { xUserId: '1234567890123456789', createdAt, updatedAt });
    render(<Dashboard settingsPersistence={{ updateSettings: vi.fn() }} />);
    const details = await screen.findByRole('region', { name: 'Contact record details' });
    expect(within(details).getByText('1234567890123456789')).toBeVisible();
    expect(within(details).getByText('Added to Contexto:')).toBeVisible();
    expect(within(details).getByText('Last updated in Contexto:')).toBeVisible();
    expect([...details.querySelectorAll('time')].map((element) => element.dateTime)).toEqual([createdAt, updatedAt]);
    expect(screen.queryByLabelText('X user ID')).not.toBeInTheDocument();
  });

  it('requires all tags, all folders, company, and query together', async () => {
    await seed('complete', ['devrel', 'speaker', 'security'], ['Friends', 'Conference']);
    await seed('partialtag', ['devrel', 'speaker'], ['Friends', 'Conference']);
    await seed('partialfolder', ['devrel', 'speaker', 'security'], ['Friends']);
    await seed('othercompany', ['devrel', 'speaker', 'security'], ['Friends', 'Conference'], 'Other');
    const accounts = await listAccountSummaries();
    const complete = accounts.find((account) => account.handle === 'complete')!;
    const filters = {
      tagIds: complete.tags.map((tag) => tag.id),
      folderIds: complete.folders.map((folder) => folder.id),
      companyIds: [complete.companyId!],
    };
    expect((await listAccountSummaries(filters)).map((account) => account.handle)).toEqual(['complete']);
    expect(await listAccountSummaries({ ...filters, query: 'missing' })).toEqual([]);
    expect(await listAccountSummaries({ ...filters, companyIds: [...filters.companyIds, accounts.find((account) => account.handle === 'othercompany')!.companyId!] })).toEqual([]);
    expect(await listAccountSummaries({ tagIds: ['missing'] })).toEqual([]);
    expect(await listAccountSummaries({ tagIds: [], folderIds: [], companyIds: [] })).toHaveLength(4);
  });

  it('updates live results for mixed selections, chip removal, query, and clear', async () => {
    await seed('complete', ['devrel', 'speaker', 'security'], ['Friends', 'Conference']);
    await seed('partial', ['devrel'], ['Friends']);
    const user = userEvent.setup();
    render(<Dashboard settingsPersistence={{ updateSettings: vi.fn() }} />);
    const results = screen.getByRole('region', { name: 'Accounts' });
    await within(results).findByRole('button', { name: /@partial/ });
    for (const label of ['Circles', 'Tags', 'Companies']) {
      await user.click(screen.getByText(label, { selector: 'summary' }));
    }
    for (const name of ['Friends', 'Conference', 'devrel', 'speaker', 'security', 'Acme']) {
      await user.click(screen.getByRole('checkbox', { name }));
    }
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(1));
    expect(within(results).getByRole('button', { name: /@complete/ })).toBeVisible();
    await user.type(screen.getByLabelText('Account search'), 'missing');
    await waitFor(() => expect(within(results).queryByRole('button')).not.toBeInTheDocument());
    await user.clear(screen.getByLabelText('Account search'));
    await user.click(screen.getByRole('button', { name: 'Remove Conference from Circles filters' }));
    await user.click(screen.getByRole('button', { name: 'Remove speaker from Tags filters' }));
    await user.click(screen.getByRole('button', { name: 'Remove security from Tags filters' }));
    await waitFor(() => expect(within(results).getAllByRole('button')).toHaveLength(2));
    await user.type(screen.getByLabelText('Search tags'), 'dev');
    expect(screen.queryByRole('checkbox', { name: 'speaker' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'devrel' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('checkbox', { name: 'devrel' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
  });
});

it.each(['company', 'role', 'location'] as const)('rejects stale dashboard %s drafts and reloads current metadata before retry', async (kind) => {
  const account = await saveAccountContext({
    profile: { platform: 'x', handle: 'managed', displayName: 'Managed', profileUrl: 'https://x.com/managed' },
    metadata: { companyName: 'Typo Co', role: 'Old role', location: 'Old place' }, tagNames: [], folderNames: [],
  });
  const user = userEvent.setup();
  render(<Dashboard settingsPersistence={{ updateSettings: vi.fn() }} />);
  const displayName = await screen.findByLabelText('Display name');
  await user.type(displayName, ' unsaved');
  const catalog = await listManagedData(kind);
  await manageData(kind, kind === 'company' ? account.companyId! : kind === 'role' ? 'old role' : 'old place',
    kind === 'role' ? { type: 'replace', value: 'Correct role' } : kind === 'company' ? { type: 'delete' } : { type: 'clear' }, catalog.revision);
  await user.click(screen.getByRole('button', { name: 'Save metadata' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Shared data changed');
  expect(displayName).toHaveValue('Managed unsaved');
  expect((await getAccountSummary(account.id))!.displayName).toBe('Managed');
  await user.click(screen.getByRole('button', { name: 'Reload saved values' }));
  await waitFor(() => expect(displayName).toHaveValue('Managed'));
  expect(screen.getByLabelText(kind === 'company' ? 'Company' : kind === 'role' ? 'Role' : 'Location', { selector: 'input' })).toHaveValue(kind === 'role' ? 'Correct role' : '');
  await user.type(displayName, ' updated');
  await user.click(screen.getByRole('button', { name: 'Save metadata' }));
  await waitFor(async () => expect((await getAccountSummary(account.id))!.displayName).toBe('Managed updated'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

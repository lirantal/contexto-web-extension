import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/src/data/db';
import { listAccountSummaries, resetDatabaseForTests, saveAccountContext } from '@/src/data/repositories';
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
    for (const label of ['Folders', 'Tags', 'Companies']) {
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
    await user.click(screen.getByRole('button', { name: 'Remove Conference from Folders filters' }));
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

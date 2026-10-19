import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '@/src/ui/Dashboard';

const mocks = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  clearTargetHistory: vi.fn(),
  companies: [] as Array<{ id: string; name: string }>,
  locations: [] as string[],
  getSettings: vi.fn(),
  markAccountCaughtUp: vi.fn(),
  removeFolder: vi.fn(),
  removeBookmark: vi.fn(),
  removeTag: vi.fn(),
  updateAccount: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((_query, dependencies?: unknown[]) => dependencies?.length
    ? mocks.accounts
    : { companies: mocks.companies, tags: [], folders: [], locations: mocks.locations }),
}));

vi.mock('@/src/data/repositories', () => ({
  addNote: vi.fn(),
  assignFolder: vi.fn(),
  assignTag: vi.fn(),
  ensureAccountFromProfile: vi.fn(),
  exportBackup: vi.fn(),
  getLookups: vi.fn(),
  importBackup: vi.fn(),
  listAccountSummaries: vi.fn(),
  listBookmarks: vi.fn().mockResolvedValue([]),
  markAccountCaughtUp: mocks.markAccountCaughtUp,
  recordSearch: vi.fn(),
  removeBookmark: mocks.removeBookmark,
  removeFolder: mocks.removeFolder,
  removeTag: mocks.removeTag,
  updateAccount: mocks.updateAccount,
  updateBookmark: vi.fn(),
}));

vi.mock('@/src/shared/settings', () => ({
  defaultSettings: {
    myXHandle: '',
    lastDashboardView: 'accounts',
    showNativeXSidebarWidgets: false,
  },
  normalizeContextoSettings: (value: Record<string, unknown>) => ({
    showNativeXSidebarWidgets: false,
    ...value,
  }),
  settingsItem: { getValue: mocks.getSettings },
  clearTargetHandleHistory: mocks.clearTargetHistory,
}));

function renderDashboard() {
  return render(<Dashboard settingsPersistence={{ updateSettings: mocks.updateSettings }} />);
}

describe('dashboard target handle history settings', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.clearAllMocks();
    mocks.accounts = [];
    mocks.companies = [];
    mocks.locations = [];
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts' });
    mocks.updateSettings.mockImplementation(async (patch) => ({
      myXHandle: '@me',
      lastDashboardView: 'accounts',
      showNativeXSidebarWidgets: false,
      ...patch,
    }));
    mocks.clearTargetHistory.mockResolvedValue(undefined);
    mocks.markAccountCaughtUp.mockResolvedValue(undefined);
  });

  it('clears target handle history and confirms the action', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: 'Clear target handle history' }));

    expect(mocks.clearTargetHistory).toHaveBeenCalledOnce();
    expect(await screen.findByText('Target handle history cleared')).toBeVisible();
  });

  it('shows X sidebar widgets only when the dashboard toggle is enabled', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const toggle = await screen.findByRole('checkbox', { name: 'Show X sidebar widgets' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      showNativeXSidebarWidgets: true,
    });
  });

  it('persists the viewer handle as a narrow settings patch', async () => {
    renderDashboard();
    const handle = await screen.findByLabelText('My X handle');

    fireEvent.change(handle, { target: { value: '@updated' } });

    expect(handle).toHaveValue('@updated');
    expect(mocks.updateSettings).toHaveBeenCalledWith({ myXHandle: '@updated' });
  });

  it('immediately removes tag and folder assignments from the selected account', async () => {
    mocks.accounts = [{
      id: 'account-1',
      platform: 'x',
      handle: 'founder',
      normalizedHandle: 'founder',
      displayName: 'Founder',
      profileUrl: 'https://x.com/founder',
      syncState: 'local-only',
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
      tags: [{
        id: 'tag-1', name: 'founder', normalizedName: 'founder',
        createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      }],
      folders: [{
        id: 'folder-1', name: 'Friends', normalizedName: 'friends',
        createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      }],
    }];
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'Remove founder from Tags' }));
    await user.click(screen.getByRole('button', { name: 'Remove Friends from Folders' }));

    expect(mocks.removeTag).toHaveBeenCalledWith('account-1', 'tag-1');
    expect(mocks.removeFolder).toHaveBeenCalledWith('account-1', 'folder-1');
  });

  it('uses fuzzy saved-company suggestions when editing account metadata', async () => {
    mocks.accounts = [{
      id: 'account-1', platform: 'x', handle: 'founder', normalizedHandle: 'founder',
      displayName: 'Founder', profileUrl: 'https://x.com/founder', syncState: 'local-only',
      createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      tags: [], folders: [],
    }];
    mocks.companies = [{ id: 'company-1', name: 'OpenAI' }];
    const user = userEvent.setup();
    renderDashboard();

    const details = await screen.findByRole('region', { name: 'Account details' });
    const company = within(details).getByLabelText('Company');
    await user.type(company, 'opi');
    await user.click(within(details).getByRole('option', { name: 'OpenAI' }));
    await user.click(screen.getByRole('button', { name: 'Save metadata' }));

    expect(mocks.updateAccount).toHaveBeenCalledWith('account-1', expect.objectContaining({
      companyName: 'OpenAI',
    }));
  });

  it('labels read-only company and latest-note metadata', async () => {
    mocks.accounts = [{
      id: 'account-1', platform: 'x', handle: 'founder', normalizedHandle: 'founder',
      displayName: 'Founder', profileUrl: 'https://x.com/founder', syncState: 'local-only',
      createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      company: {
        id: 'company-1', name: 'OpenAI', normalizedName: 'openai',
        createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      },
      latestNote: {
        id: 'note-1', accountId: 'account-1', body: 'Follow up after the launch.', source: 'manual',
        createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      },
      tags: [], folders: [],
    }];
    renderDashboard();

    const accountRow = await screen.findByRole('button', { name: /Founder/ });
    expect(accountRow).toHaveTextContent('@founder');
    expect(within(accountRow).getByText('Company:')).toBeVisible();
    expect(within(accountRow).getByText('OpenAI')).toBeVisible();

    const details = screen.getByRole('region', { name: 'Account details' });
    expect(within(details).getByText('Latest note:')).toBeVisible();
    expect(within(details).getByText('Follow up after the launch.')).toBeVisible();
  });

  it('omits labels for empty read-only company and latest-note metadata', async () => {
    mocks.accounts = [
      {
        id: 'empty-account', platform: 'x', handle: 'empty', normalizedHandle: 'empty',
        displayName: 'Empty metadata', profileUrl: 'https://x.com/empty', syncState: 'local-only',
        createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
        company: {
          id: 'empty-company', name: '', normalizedName: '',
          createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
        },
        latestNote: {
          id: 'empty-note', accountId: 'empty-account', body: '', source: 'manual',
          createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
        },
        tags: [], folders: [],
      },
      {
        id: 'whitespace-account', platform: 'x', handle: 'whitespace', normalizedHandle: 'whitespace',
        displayName: 'Whitespace metadata', profileUrl: 'https://x.com/whitespace', syncState: 'local-only',
        createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
        company: {
          id: 'whitespace-company', name: '  ', normalizedName: '',
          createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
        },
        latestNote: {
          id: 'whitespace-note', accountId: 'whitespace-account', body: '  ', source: 'manual',
          createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
        },
        tags: [], folders: [],
      },
    ];
    const user = userEvent.setup();
    renderDashboard();

    const emptyRow = await screen.findByRole('button', { name: /Empty metadata/ });
    const details = screen.getByRole('region', { name: 'Account details' });
    expect(within(emptyRow).queryByText('Company:')).not.toBeInTheDocument();
    expect(within(details).queryByText('Latest note:')).not.toBeInTheDocument();

    const whitespaceRow = screen.getByRole('button', { name: /Whitespace metadata/ });
    expect(within(whitespaceRow).queryByText('Company:')).not.toBeInTheDocument();
    await user.click(whitespaceRow);
    expect(within(details).queryByText('Latest note:')).not.toBeInTheDocument();
  });

  it('uses fuzzy saved-location suggestions when editing account metadata', async () => {
    mocks.accounts = [{
      id: 'account-1', platform: 'x', handle: 'founder', normalizedHandle: 'founder',
      displayName: 'Founder', profileUrl: 'https://x.com/founder', syncState: 'local-only',
      createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      tags: [], folders: [],
    }];
    mocks.locations = ['San Francisco'];
    const user = userEvent.setup();
    renderDashboard();

    const location = await screen.findByLabelText('Location');
    await user.type(location, 'sfr');
    await user.click(screen.getByRole('option', { name: 'San Francisco' }));
    await user.click(screen.getByRole('button', { name: 'Save metadata' }));

    expect(mocks.updateAccount).toHaveBeenCalledWith('account-1', expect.objectContaining({
      location: 'San Francisco',
    }));
  });

  it('offers catch-up search and an explicit checkpoint action for the selected account', async () => {
    mocks.accounts = [{
      id: 'account-1', platform: 'x', handle: 'founder', normalizedHandle: 'founder',
      displayName: 'Founder', profileUrl: 'https://x.com/founder', syncState: 'local-only',
      lastCatchUpAt: '2026-07-10T18:42:00.000Z',
      createdAt: '2026-07-12T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z',
      tags: [], folders: [],
    }];
    const user = userEvent.setup();
    renderDashboard();

    const link = await screen.findByRole('link', { name: 'Catch up on X' });
    expect(new URL(link.getAttribute('href')!).searchParams.get('q'))
      .toBe('from:founder since:2026-07-10');
    await user.click(screen.getByRole('button', { name: 'Mark caught up' }));
    expect(mocks.markAccountCaughtUp).toHaveBeenCalledWith('account-1');
  });
});

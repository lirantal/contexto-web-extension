import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '@/src/ui/Dashboard';

const mocks = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  clearTargetHistory: vi.fn(),
  getSettings: vi.fn(),
  markAccountCaughtUp: vi.fn(),
  removeFolder: vi.fn(),
  removeBookmark: vi.fn(),
  removeTag: vi.fn(),
  setSettings: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((_query, dependencies?: unknown[]) => dependencies?.length
    ? mocks.accounts
    : { companies: [], tags: [], folders: [] }),
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
  updateAccount: vi.fn(),
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
  settingsItem: { getValue: mocks.getSettings, setValue: mocks.setSettings },
  clearTargetHandleHistory: mocks.clearTargetHistory,
}));

describe('dashboard target handle history settings', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.clearAllMocks();
    mocks.accounts = [];
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts' });
    mocks.setSettings.mockResolvedValue(undefined);
    mocks.clearTargetHistory.mockResolvedValue(undefined);
    mocks.markAccountCaughtUp.mockResolvedValue(undefined);
  });

  it('clears target handle history and confirms the action', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByRole('button', { name: 'Clear target handle history' }));

    expect(mocks.clearTargetHistory).toHaveBeenCalledOnce();
    expect(await screen.findByText('Target handle history cleared')).toBeVisible();
  });

  it('shows X sidebar widgets only when the dashboard toggle is enabled', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    const toggle = await screen.findByRole('checkbox', { name: 'Show X sidebar widgets' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    expect(mocks.setSettings).toHaveBeenCalledWith({
      myXHandle: '@me',
      lastDashboardView: 'accounts',
      showNativeXSidebarWidgets: true,
    });
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
    render(<Dashboard />);

    await user.click(await screen.findByRole('button', { name: 'Remove founder from Tags' }));
    await user.click(screen.getByRole('button', { name: 'Remove Friends from Folders' }));

    expect(mocks.removeTag).toHaveBeenCalledWith('account-1', 'tag-1');
    expect(mocks.removeFolder).toHaveBeenCalledWith('account-1', 'folder-1');
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
    render(<Dashboard />);

    const link = await screen.findByRole('link', { name: 'Catch up on X' });
    expect(new URL(link.getAttribute('href')!).searchParams.get('q'))
      .toBe('from:founder since:2026-07-10');
    await user.click(screen.getByRole('button', { name: 'Mark caught up' }));
    expect(mocks.markAccountCaughtUp).toHaveBeenCalledWith('account-1');
  });
});

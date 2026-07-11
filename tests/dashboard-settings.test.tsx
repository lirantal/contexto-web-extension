import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '@/src/ui/Dashboard';

const mocks = vi.hoisted(() => ({
  clearTargetHistory: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((_query, dependencies?: unknown[]) => dependencies?.length
    ? []
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
  recordSearch: vi.fn(),
  updateAccount: vi.fn(),
}));

vi.mock('@/src/shared/settings', () => ({
  defaultSettings: { myXHandle: '', lastDashboardView: 'accounts' },
  settingsItem: { getValue: mocks.getSettings, setValue: vi.fn() },
  clearTargetHandleHistory: mocks.clearTargetHistory,
}));

describe('dashboard target handle history settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts' });
    mocks.clearTargetHistory.mockResolvedValue(undefined);
  });

  it('clears target handle history and confirms the action', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByRole('button', { name: 'Clear target handle history' }));

    expect(mocks.clearTargetHistory).toHaveBeenCalledOnce();
    expect(await screen.findByText('Target handle history cleared')).toBeVisible();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/entrypoints/popup/App';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  setSettings: vi.fn(),
  getSearchState: vi.fn(),
  setSearchState: vi.fn(),
  getHistory: vi.fn(),
  listAccounts: vi.fn(),
  sendMessage: vi.fn(),
  createTab: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { openOptionsPage: vi.fn(), sendMessage: mocks.sendMessage },
    tabs: { create: mocks.createTab },
  },
}));

vi.mock('@/src/data/repositories', () => ({
  listTargetAccountSuggestions: mocks.listAccounts,
}));

vi.mock('@/src/shared/settings', () => ({
  defaultSettings: { myXHandle: '', lastDashboardView: 'accounts' },
  defaultPopupSearchState: { targetHandle: '', keyword: '', since: '', until: '' },
  settingsItem: { getValue: mocks.getSettings, setValue: mocks.setSettings, watch: vi.fn(() => () => undefined) },
  popupSearchStateItem: { getValue: mocks.getSearchState, setValue: mocks.setSearchState, watch: vi.fn(() => () => undefined) },
  targetHandleHistoryItem: { getValue: mocks.getHistory, watch: vi.fn(() => () => undefined) },
}));

describe('popup target handle autosuggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('browser', {
      runtime: { openOptionsPage: vi.fn(), sendMessage: mocks.sendMessage },
      tabs: { create: mocks.createTab },
    });
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts' });
    mocks.getSearchState.mockResolvedValue({ targetHandle: '', keyword: '', since: '', until: '' });
    mocks.getHistory.mockResolvedValue([{ handle: 'recent_only', searchedAt: '2026-07-11T00:00:00Z' }]);
    mocks.listAccounts.mockResolvedValue([{
      id: 'account_alice',
      handle: 'alice_dev',
      displayName: 'Alice Example',
      companyName: 'Acme',
      updatedAt: '2026-07-10T00:00:00Z',
    }]);
    mocks.setSettings.mockResolvedValue(undefined);
    mocks.setSearchState.mockResolvedValue(undefined);
    mocks.createTab.mockResolvedValue({ id: 1 });
    mocks.sendMessage.mockImplementation(async (message) => {
      if (message.type === 'contexto:settings:update') {
        return {
          ok: true,
          settings: { myXHandle: message.patch.myXHandle ?? '@me', lastDashboardView: 'accounts' },
        };
      }
      if (message.type === 'contexto:search-state:update') {
        return {
          ok: true,
          searchState: { targetHandle: '', keyword: '', since: '', until: '', ...message.patch },
        };
      }
      if (message.type === 'contexto:target-history:promote') {
        return {
          ok: true,
          targetHandleHistory: [{ handle: message.handle, searchedAt: '2026-07-11T00:00:00Z' }],
        };
      }
      throw new Error('Unexpected request');
    });
  });

  it('loads rich suggestions and persists the selected handle', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = await screen.findByRole('combobox', { name: "Other person's X handle" });

    await user.click(input);
    await user.click(await screen.findByRole('option', { name: /Alice Example/ }));

    expect(input).toHaveValue('@alice_dev');
    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith({
      type: 'contexto:search-state:update',
      patch: { targetHandle: '@alice_dev' },
    }));
  });

  it('records the normalized target only after a search tab opens successfully', async () => {
    mocks.getSearchState.mockResolvedValue({ targetHandle: '@Alice_Dev', keyword: '', since: '', until: '' });
    render(<App />);

    const searchButton = await screen.findByRole('button', { name: /Posts by other person/ });
    await waitFor(() => expect(searchButton).toBeEnabled());
    fireEvent.click(searchButton);

    await waitFor(() => expect(mocks.createTab).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith({
      type: 'contexto:target-history:promote',
      handle: 'alice_dev',
    }));
    const promotionCall = mocks.sendMessage.mock.calls.findIndex(
      ([message]) => message.type === 'contexto:target-history:promote',
    );
    expect(mocks.createTab.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.sendMessage.mock.invocationCallOrder[promotionCall]);
  });

  it('does not record history when opening the search tab fails', async () => {
    mocks.getSearchState.mockResolvedValue({ targetHandle: '@Alice_Dev', keyword: '', since: '', until: '' });
    mocks.createTab.mockRejectedValueOnce(new Error('Tabs unavailable'));
    render(<App />);

    const searchButton = await screen.findByRole('button', { name: /Posts by other person/ });
    await waitFor(() => expect(searchButton).toBeEnabled());
    fireEvent.click(searchButton);
    await waitFor(() => expect(mocks.createTab).toHaveBeenCalledOnce());
    expect(mocks.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'contexto:target-history:promote',
    }));
  });
});

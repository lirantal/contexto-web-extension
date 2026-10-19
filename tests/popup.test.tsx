import React from 'react';
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
  sendMessage: vi.fn(),
  createTab: vi.fn(),
  listAccounts: vi.fn(),
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

describe('popup search form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts' });
    mocks.getSearchState.mockResolvedValue({
      targetHandle: '@them',
      keyword: 'security',
      since: '2026-01-01',
      until: '2026-02-01',
    });
    mocks.setSettings.mockResolvedValue(undefined);
    mocks.setSearchState.mockResolvedValue(undefined);
    mocks.getHistory.mockResolvedValue([]);
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
          searchState: {
            targetHandle: '@them',
            keyword: 'security',
            since: '2026-01-01',
            until: '2026-02-01',
            ...message.patch,
          },
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
    mocks.createTab.mockResolvedValue({ id: 1 });
    mocks.listAccounts.mockResolvedValue([]);
  });

  it('restores every search field when the popup opens again', async () => {
    render(<App />);

    expect(await screen.findByLabelText('My X handle')).toHaveValue('@me');
    expect(screen.getByLabelText(/Other person/)).toHaveValue('@them');
    expect(screen.getByLabelText('Keyword')).toHaveValue('security');
    expect(screen.getByLabelText('Since')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Until')).toHaveValue('2026-02-01');
  });

  it('persists changes to the optional search fields', async () => {
    render(<App />);
    const keyword = await screen.findByLabelText('Keyword');

    fireEvent.change(keyword, { target: { value: 'typescript' } });

    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith({
      type: 'contexto:search-state:update',
      patch: { keyword: 'typescript' },
    }));
  });

  it('clears and persists the other person’s X handle', async () => {
    const user = userEvent.setup();
    render(<App />);

    const clearButton = await screen.findByRole('button', { name: "Clear other person's X handle" });
    await user.click(clearButton);

    expect(screen.getByLabelText(/Other person/)).toHaveValue('');
    expect(screen.queryByRole('button', { name: "Clear other person's X handle" })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledWith({
      type: 'contexto:search-state:update',
      patch: { targetHandle: '' },
    }));
  });

  it('applies available popup state when another startup source fails', async () => {
    mocks.getSettings.mockResolvedValue({ myXHandle: '@available', lastDashboardView: 'accounts' });
    mocks.getSearchState.mockRejectedValue(new Error('Search state unavailable'));
    mocks.getHistory.mockRejectedValue(new Error('History unavailable'));
    mocks.listAccounts.mockRejectedValue(new Error('Accounts unavailable'));

    render(<App />);

    expect(await screen.findByLabelText('My X handle')).toHaveValue('@available');
    expect(screen.getByLabelText(/Other person/)).toHaveValue('');
    expect(screen.getByLabelText('Keyword')).toHaveValue('');
  });
});

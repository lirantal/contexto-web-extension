import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickXSearch, type QuickXSearchProps } from '@/src/ui/QuickXSearch';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  setSettings: vi.fn(),
  watchSettings: vi.fn(),
  getSearchState: vi.fn(),
  setSearchState: vi.fn(),
  watchSearchState: vi.fn(),
  getHistory: vi.fn(),
  watchHistory: vi.fn(),
  recordTarget: vi.fn(),
}));

vi.mock('@/src/shared/settings', () => ({
  defaultSettings: { myXHandle: '', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false },
  defaultPopupSearchState: { targetHandle: '', keyword: '', since: '', until: '' },
  settingsItem: {
    getValue: mocks.getSettings,
    setValue: mocks.setSettings,
    watch: mocks.watchSettings,
  },
  popupSearchStateItem: {
    getValue: mocks.getSearchState,
    setValue: mocks.setSearchState,
    watch: mocks.watchSearchState,
  },
  targetHandleHistoryItem: {
    getValue: mocks.getHistory,
    watch: mocks.watchHistory,
  },
  recordTargetHandleSearch: mocks.recordTarget,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderQuickSearch(options: Partial<React.ComponentProps<typeof QuickXSearch>> = {}) {
  const loadAccountSuggestions = options.loadAccountSuggestions ?? vi.fn().mockResolvedValue([]);
  const defaultLaunchSearch = vi.fn<QuickXSearchProps['launchSearch']>().mockResolvedValue(undefined);
  const launchSearch = options.launchSearch ?? defaultLaunchSearch;

  render(
    <QuickXSearch
      surface="sidebar"
      loadAccountSuggestions={loadAccountSuggestions}
      launchSearch={launchSearch}
    />,
  );

  return { loadAccountSuggestions, launchSearch: defaultLaunchSearch };
}

describe('QuickXSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false });
    mocks.getSearchState.mockResolvedValue({
      targetHandle: '@them',
      keyword: 'security',
      since: '2026-01-01',
      until: '2026-02-01',
    });
    mocks.getHistory.mockResolvedValue([]);
    mocks.setSettings.mockResolvedValue(undefined);
    mocks.setSearchState.mockResolvedValue(undefined);
    mocks.recordTarget.mockResolvedValue([]);
    mocks.watchSettings.mockReturnValue(() => undefined);
    mocks.watchSearchState.mockReturnValue(() => undefined);
    mocks.watchHistory.mockReturnValue(() => undefined);
  });

  it('restores each persisted search field', async () => {
    renderQuickSearch();

    expect(await screen.findByLabelText('My X handle')).toHaveValue('@me');
    expect(screen.getByLabelText(/Other person/)).toHaveValue('@them');
    expect(screen.getByLabelText('Keyword')).toHaveValue('security');
    expect(screen.getByLabelText('Since')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Until')).toHaveValue('2026-02-01');
  });

  it('persists a changed keyword', async () => {
    renderQuickSearch();
    const keyword = await screen.findByLabelText('Keyword');

    fireEvent.change(keyword, { target: { value: 'typescript' } });

    await waitFor(() => expect(mocks.setSearchState).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'typescript' })));
  });

  it('launches before recording the normalized target history', async () => {
    const { launchSearch } = renderQuickSearch();

    fireEvent.click(await screen.findByRole('button', { name: /Posts by other person/ }));

    await waitFor(() => expect(launchSearch).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'from-profile', targetHandle: 'them', keyword: 'security',
    })));
    await waitFor(() => expect(mocks.recordTarget).toHaveBeenCalledWith('them'));
    expect(launchSearch.mock.invocationCallOrder[0]).toBeLessThan(mocks.recordTarget.mock.invocationCallOrder[0]);
  });

  it('does not record target history when launch fails', async () => {
    const launchSearch = vi.fn<QuickXSearchProps['launchSearch']>().mockRejectedValue(new Error('Tabs unavailable'));
    renderQuickSearch({ launchSearch });

    fireEvent.click(await screen.findByRole('button', { name: /Posts by other person/ }));

    await waitFor(() => expect(launchSearch).toHaveBeenCalledOnce());
    expect(mocks.recordTarget).not.toHaveBeenCalled();
  });

  it('keeps every field usable when optional startup sources fail', async () => {
    mocks.getHistory.mockRejectedValue(new Error('History unavailable'));
    const { loadAccountSuggestions } = renderQuickSearch({ loadAccountSuggestions: vi.fn().mockRejectedValue(new Error('Accounts unavailable')) });

    const myHandle = await screen.findByLabelText('My X handle');
    const targetHandle = screen.getByLabelText(/Other person/);
    const keyword = screen.getByLabelText('Keyword');
    const since = screen.getByLabelText('Since');
    const until = screen.getByLabelText('Until');
    fireEvent.change(myHandle, { target: { value: '@updated' } });
    fireEvent.change(targetHandle, { target: { value: '@freeform' } });
    fireEvent.change(keyword, { target: { value: 'typescript' } });
    fireEvent.change(since, { target: { value: '2026-03-01' } });
    fireEvent.change(until, { target: { value: '2026-04-01' } });

    expect(myHandle).toHaveValue('@updated');
    expect(targetHandle).toHaveValue('@freeform');
    expect(keyword).toHaveValue('typescript');
    expect(since).toHaveValue('2026-03-01');
    expect(until).toHaveValue('2026-04-01');
    await waitFor(() => expect(loadAccountSuggestions).toHaveBeenCalledOnce());
  });

  it('disables search actions when their required handles are missing', async () => {
    mocks.getSettings.mockResolvedValue({ myXHandle: '', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false });
    mocks.getSearchState.mockResolvedValue({ targetHandle: '', keyword: '', since: '', until: '' });
    renderQuickSearch();

    expect(await screen.findByRole('button', { name: /Posts by me/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Posts to me/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Posts by other person/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Mentions of other person/ })).toBeDisabled();
  });

  it('refreshes an already-mounted form when popup search state changes elsewhere', async () => {
    renderQuickSearch();
    await screen.findByLabelText('Keyword');
    const callback = mocks.watchSearchState.mock.calls[0][0] as (value: { targetHandle: string; keyword: string; since: string; until: string }) => void;

    act(() => {
      callback({ targetHandle: '@changed', keyword: 'updated', since: '2026-03-01', until: '2026-04-01' });
    });

    await waitFor(() => expect(screen.getByLabelText(/Other person/)).toHaveValue('@changed'));
    expect(screen.getByLabelText('Keyword')).toHaveValue('updated');
    expect(screen.getByLabelText('Since')).toHaveValue('2026-03-01');
    expect(screen.getByLabelText('Until')).toHaveValue('2026-04-01');
  });

  it("applies startup sources independently without overwriting newer watched values", async () => {
    const accounts = createDeferred<never[]>();
    const initialSearchState = createDeferred<{ targetHandle: string; keyword: string; since: string; until: string }>();
    mocks.getSearchState.mockReturnValue(initialSearchState.promise);
    renderQuickSearch({ loadAccountSuggestions: vi.fn().mockReturnValue(accounts.promise) });

    await waitFor(() => expect(screen.getByLabelText("My X handle")).toHaveValue("@me"));
    const callback = mocks.watchSearchState.mock.calls[0][0] as (value: {
      targetHandle: string;
      keyword: string;
      since: string;
      until: string;
    }) => void;
    act(() => {
      callback({ targetHandle: "@watched", keyword: "newer", since: "2026-03-01", until: "2026-04-01" });
    });

    expect(screen.getByLabelText("Keyword")).toHaveValue("newer");
    await act(async () => {
      initialSearchState.resolve({ targetHandle: "@them", keyword: "security", since: "2026-01-01", until: "2026-02-01" });
      accounts.resolve([]);
      await Promise.all([initialSearchState.promise, accounts.promise]);
    });

    expect(screen.getByLabelText("Keyword")).toHaveValue("newer");
    expect(screen.getByLabelText(new RegExp("Other person"))).toHaveValue("@watched");
  });
});

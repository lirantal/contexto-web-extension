import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickXSearch, type QuickXSearchProps } from '@/src/ui/QuickXSearch';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  legacySetSettings: vi.fn(),
  watchSettings: vi.fn(),
  getSearchState: vi.fn(),
  legacySetSearchState: vi.fn(),
  watchSearchState: vi.fn(),
  getHistory: vi.fn(),
  watchHistory: vi.fn(),
  legacyRecordTarget: vi.fn(),
  updateSettings: vi.fn(),
  updateSearchState: vi.fn(),
  promoteTargetHandle: vi.fn(),
  unwatchSettings: vi.fn(),
  unwatchSearchState: vi.fn(),
  unwatchHistory: vi.fn(),
}));

vi.mock('@/src/shared/settings', () => ({
  defaultSettings: { myXHandle: '', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false },
  defaultPopupSearchState: { targetHandle: '', keyword: '', since: '', until: '' },
  settingsItem: {
    getValue: mocks.getSettings,
    setValue: mocks.legacySetSettings,
    watch: mocks.watchSettings,
  },
  popupSearchStateItem: {
    getValue: mocks.getSearchState,
    setValue: mocks.legacySetSearchState,
    watch: mocks.watchSearchState,
  },
  targetHandleHistoryItem: {
    getValue: mocks.getHistory,
    watch: mocks.watchHistory,
  },
  recordTargetHandleSearch: mocks.legacyRecordTarget,
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
  const launchSearch = (options.launchSearch ?? defaultLaunchSearch) as typeof defaultLaunchSearch;
  const persistence = options.persistence ?? {
    updateSettings: mocks.updateSettings,
    updateSearchState: mocks.updateSearchState,
    promoteTargetHandle: mocks.promoteTargetHandle,
  };

  render(
    <QuickXSearch
      surface={options.surface ?? "sidebar"}
      loadAccountSuggestions={loadAccountSuggestions}
      launchSearch={launchSearch}
      persistence={persistence}
    />,
  );

  return { loadAccountSuggestions, launchSearch };
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
    mocks.legacySetSettings.mockResolvedValue(undefined);
    mocks.legacySetSearchState.mockResolvedValue(undefined);
    mocks.legacyRecordTarget.mockResolvedValue([]);
    mocks.updateSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false });
    mocks.updateSearchState.mockResolvedValue({ targetHandle: '@them', keyword: 'security', since: '2026-01-01', until: '2026-02-01' });
    mocks.promoteTargetHandle.mockResolvedValue([]);
    mocks.watchSettings.mockReturnValue(mocks.unwatchSettings);
    mocks.watchSearchState.mockReturnValue(mocks.unwatchSearchState);
    mocks.watchHistory.mockReturnValue(mocks.unwatchHistory);
  });

  it.each(['sidebar', 'popup'] as const)('applies date shortcuts together and allows manual overrides in %s', async (surface) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 19, 0, 15));
    try {
      const { launchSearch } = renderQuickSearch({ surface });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeEnabled());
      for (const [label, since] of [
        ['Last 30 days', '2026-09-19'],
        ['Last 90 days', '2026-07-21'],
        ['Last 12 months', '2025-10-19'],
      ]) {
        fireEvent.click(screen.getByRole('button', { name: label }));
        expect(screen.getByLabelText('Since')).toHaveValue(since);
        expect(screen.getByLabelText('Until')).toHaveValue('2026-10-19');
        expect(mocks.updateSearchState).toHaveBeenLastCalledWith({ since, until: '2026-10-19' });
        expect(screen.getByRole('button', { name: /Posts by other person/ })).toHaveAttribute(
          'title', 'from:them security since:' + since + ' until:2026-10-19');
      }
      expect(mocks.updateSearchState).toHaveBeenCalledTimes(3);
      expect(screen.getByLabelText('My X handle')).toHaveValue('@me');
      expect(screen.getByLabelText(/Other person/)).toHaveValue('@them');
      expect(screen.getByLabelText('Keyword')).toHaveValue('security');
      expect(launchSearch).not.toHaveBeenCalled();
      expect(mocks.promoteTargetHandle).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText('Since'), { target: { value: '2026-10-01' } });
      expect(screen.getByLabelText('Since')).toHaveValue('2026-10-01');
      expect(screen.getByLabelText('Until')).toHaveValue('2026-10-19');
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for the complete date range to persist before launching', async () => {
    const write = createDeferred<{ targetHandle: string; keyword: string; since: string; until: string }>();
    mocks.updateSearchState.mockReturnValue(write.promise);
    const { launchSearch } = renderQuickSearch();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));
    fireEvent.click(screen.getByRole('button', { name: /Posts by other person/ }));
    expect(launchSearch).not.toHaveBeenCalled();
    const patch = mocks.updateSearchState.mock.calls[0][0];
    await act(async () => write.resolve({ targetHandle: '@them', keyword: 'security', ...patch }));
    await waitFor(() => expect(launchSearch).toHaveBeenCalledWith(expect.objectContaining(patch)));
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

    expect(keyword).toHaveValue('typescript');
    await waitFor(() => expect(mocks.updateSearchState).toHaveBeenCalledWith({ keyword: 'typescript' }));
  });

  it('accepts an external target update after reselecting the unchanged target without a watch echo', async () => {
    const user = userEvent.setup();
    renderQuickSearch({
      loadAccountSuggestions: vi.fn().mockResolvedValue([{
        id: 'account-them',
        handle: 'them',
        displayName: 'Them',
        updatedAt: '2026-10-19T00:00:00.000Z',
      }]),
    });
    const targetHandle = await screen.findByLabelText(/Other person/);
    await waitFor(() => expect(targetHandle).toBeEnabled());

    await user.click(targetHandle);
    await user.click(await screen.findByRole('option', { name: /Them.*@them/i }));
    await act(async () => Promise.resolve());

    const watchSearchState = mocks.watchSearchState.mock.calls[0][0] as (
      value: { targetHandle: string; keyword: string; since: string; until: string },
    ) => void;
    act(() => {
      watchSearchState({
        targetHandle: '@external',
        keyword: 'security',
        since: '2026-01-01',
        until: '2026-02-01',
      });
    });

    expect(targetHandle).toHaveValue('@external');
    expect(mocks.updateSearchState).not.toHaveBeenCalled();
  });

  it('launches before recording the normalized target history', async () => {
    const { launchSearch } = renderQuickSearch();

    const action = await screen.findByRole('button', { name: /Posts by other person/ });
    await waitFor(() => expect(action).toBeEnabled());
    fireEvent.click(action);

    await waitFor(() => expect(launchSearch).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'from-profile', targetHandle: 'them', keyword: 'security',
    })));
    await waitFor(() => expect(mocks.promoteTargetHandle).toHaveBeenCalledWith('them'));
    expect(launchSearch.mock.invocationCallOrder[0]).toBeLessThan(mocks.promoteTargetHandle.mock.invocationCallOrder[0]);
  });

  it('does not record target history when launch fails', async () => {
    const launchSearch = vi.fn<QuickXSearchProps['launchSearch']>().mockRejectedValue(new Error('Tabs unavailable'));
    renderQuickSearch({ launchSearch });

    fireEvent.click(await screen.findByRole('button', { name: /Posts by other person/ }));

    await waitFor(() => expect(launchSearch).toHaveBeenCalledOnce());
    expect(mocks.promoteTargetHandle).not.toHaveBeenCalled();
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


  it('keeps settings and search fields disabled until their own hydration settles', async () => {
    const user = userEvent.setup();
    const settings = createDeferred<{ myXHandle: string; lastDashboardView: 'accounts'; showNativeXSidebarWidgets: boolean }>();
    const searchState = createDeferred<{ targetHandle: string; keyword: string; since: string; until: string }>();
    mocks.getSettings.mockReturnValue(settings.promise);
    mocks.getSearchState.mockReturnValue(searchState.promise);
    renderQuickSearch();

    const myHandle = screen.getByLabelText('My X handle');
    const targetHandle = screen.getByLabelText(/Other person/);
    const keyword = screen.getByLabelText('Keyword');
    expect(myHandle).toBeDisabled();
    expect(targetHandle).toBeDisabled();
    expect(keyword).toBeDisabled();
    expect(screen.getByLabelText('Since')).toBeDisabled();
    expect(screen.getByLabelText('Until')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Posts by me/ })).toBeDisabled();
    await user.type(keyword, 'early edit');
    expect(keyword).toHaveValue('');
    expect(mocks.updateSearchState).not.toHaveBeenCalled();

    await act(async () => {
      settings.resolve({ myXHandle: '@persisted-me', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false });
      searchState.resolve({ targetHandle: '@persisted-them', keyword: 'persisted', since: '2026-05-01', until: '2026-06-01' });
      await Promise.all([settings.promise, searchState.promise]);
    });

    await waitFor(() => expect(myHandle).toBeEnabled());
    expect(targetHandle).toBeEnabled();
    expect(keyword).toBeEnabled();
    expect(myHandle).toHaveValue('@persisted-me');
    expect(targetHandle).toHaveValue('@persisted-them');
    expect(keyword).toHaveValue('persisted');
  });

  it('enables fallback defaults after settings and search-state hydration reject', async () => {
    mocks.getSettings.mockRejectedValue(new Error('Settings unavailable'));
    mocks.getSearchState.mockRejectedValue(new Error('Search state unavailable'));
    renderQuickSearch();

    await waitFor(() => expect(screen.getByLabelText('My X handle')).toBeEnabled());
    expect(screen.getByLabelText(/Other person/)).toBeEnabled();
    expect(screen.getByLabelText('Keyword')).toBeEnabled();
    expect(screen.getByLabelText('Since')).toBeEnabled();
    expect(screen.getByLabelText('Until')).toBeEnabled();
  });

  it('waits for an outstanding field patch before launching with immediate local feedback', async () => {
    const persisted = createDeferred<{ targetHandle: string; keyword: string; since: string; until: string }>();
    mocks.updateSearchState.mockReturnValueOnce(persisted.promise);
    const { launchSearch } = renderQuickSearch();
    const keyword = await screen.findByLabelText('Keyword');
    await waitFor(() => expect(keyword).toBeEnabled());

    fireEvent.change(keyword, { target: { value: 'new local value' } });
    expect(keyword).toHaveValue('new local value');
    fireEvent.click(screen.getByRole('button', { name: /Posts by other person/ }));
    await Promise.resolve();
    expect(launchSearch).not.toHaveBeenCalled();

    await act(async () => {
      persisted.resolve({ targetHandle: '@them', keyword: 'new local value', since: '2026-01-01', until: '2026-02-01' });
      await persisted.promise;
    });
    await waitFor(() => expect(launchSearch).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'from-profile',
      keyword: 'new local value',
    })));
  });

  it('keeps a newer local edit when an older queued write echoes through storage', async () => {
    const firstWrite = createDeferred<{
      targetHandle: string;
      keyword: string;
      since: string;
      until: string;
    }>();
    const secondWrite = createDeferred<{
      targetHandle: string;
      keyword: string;
      since: string;
      until: string;
    }>();
    mocks.updateSearchState
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    const { launchSearch } = renderQuickSearch();
    const keyword = await screen.findByLabelText('Keyword');
    const watchSearchState = mocks.watchSearchState.mock.calls[0][0] as (
      value: { targetHandle: string; keyword: string; since: string; until: string },
    ) => void;

    fireEvent.change(keyword, { target: { value: 'first edit' } });
    fireEvent.change(keyword, { target: { value: 'second edit' } });
    act(() => {
      watchSearchState({
        targetHandle: '@them',
        keyword: 'first edit',
        since: '2026-03-01',
        until: '2026-02-01',
      });
    });

    expect(keyword).toHaveValue('second edit');
    expect(screen.getByLabelText('Since')).toHaveValue('2026-03-01');
    fireEvent.click(screen.getByRole('button', { name: /Posts by other person/ }));
    await act(async () => {
      firstWrite.resolve({ targetHandle: '@them', keyword: 'first edit', since: '2026-01-01', until: '2026-02-01' });
      secondWrite.resolve({ targetHandle: '@them', keyword: 'second edit', since: '2026-03-01', until: '2026-02-01' });
      await Promise.all([firstWrite.promise, secondWrite.promise]);
    });
    await waitFor(() => expect(launchSearch).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'second edit',
      since: '2026-03-01',
    })));
  });

  it('keeps the newest repeated value through ordered A-B-A storage echoes', async () => {
    renderQuickSearch();
    const keyword = await screen.findByLabelText('Keyword');
    const watchSearchState = mocks.watchSearchState.mock.calls[0][0] as (
      value: { targetHandle: string; keyword: string; since: string; until: string },
    ) => void;

    fireEvent.change(keyword, { target: { value: 'alpha' } });
    fireEvent.change(keyword, { target: { value: 'beta' } });
    fireEvent.change(keyword, { target: { value: 'alpha' } });

    act(() => {
      watchSearchState({ targetHandle: '@them', keyword: 'alpha', since: '2026-01-01', until: '2026-02-01' });
    });
    expect(keyword).toHaveValue('alpha');

    act(() => {
      watchSearchState({ targetHandle: '@them', keyword: 'beta', since: '2026-01-01', until: '2026-02-01' });
    });
    expect(keyword).toHaveValue('alpha');

    act(() => {
      watchSearchState({ targetHandle: '@them', keyword: 'alpha', since: '2026-01-01', until: '2026-02-01' });
    });
    expect(keyword).toHaveValue('alpha');
  });

  it('waits for an edit that begins while an earlier launch write is pending', async () => {
    const firstWrite = createDeferred<{
      targetHandle: string;
      keyword: string;
      since: string;
      until: string;
    }>();
    const secondWrite = createDeferred<{
      targetHandle: string;
      keyword: string;
      since: string;
      until: string;
    }>();
    mocks.updateSearchState
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    const { launchSearch } = renderQuickSearch();
    const keyword = await screen.findByLabelText('Keyword');

    fireEvent.change(keyword, { target: { value: 'first pending edit' } });
    fireEvent.click(screen.getByRole('button', { name: /Posts by other person/ }));
    fireEvent.change(keyword, { target: { value: 'second pending edit' } });

    await act(async () => {
      firstWrite.resolve({
        targetHandle: '@them',
        keyword: 'first pending edit',
        since: '2026-01-01',
        until: '2026-02-01',
      });
      await firstWrite.promise;
    });
    expect(launchSearch).not.toHaveBeenCalled();

    await act(async () => {
      secondWrite.resolve({
        targetHandle: '@them',
        keyword: 'second pending edit',
        since: '2026-01-01',
        until: '2026-02-01',
      });
      await secondWrite.promise;
    });
    await waitFor(() => expect(launchSearch).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'second pending edit',
    })));
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
  it('refreshes settings and target history from storage watches', async () => {
    renderQuickSearch();
    await screen.findByLabelText('Keyword');
    const settingsCallback = mocks.watchSettings.mock.calls[0][0] as (value: {
      myXHandle: string;
      lastDashboardView: 'accounts';
      showNativeXSidebarWidgets: boolean;
    }) => void;
    const historyCallback = mocks.watchHistory.mock.calls[0][0] as (value: Array<{
      handle: string;
      searchedAt: string;
    }>) => void;

    act(() => {
      settingsCallback({ myXHandle: '@watched-me', lastDashboardView: 'accounts', showNativeXSidebarWidgets: true });
      historyCallback([{ handle: 'watched-target', searchedAt: '2026-10-19T00:00:00.000Z' }]);
    });

    expect(screen.getByLabelText('My X handle')).toHaveValue('@watched-me');
    fireEvent.change(screen.getByLabelText(/Other person/), { target: { value: '' } });
    fireEvent.focus(screen.getByLabelText(/Other person/));
    expect(await screen.findByRole('option', { name: /@watched-target.*Recent/i })).toBeVisible();
  });

  it('cleans up every storage watcher when unmounted', async () => {
    const { unmount } = render(
      <QuickXSearch
        surface="sidebar"
        loadAccountSuggestions={vi.fn().mockResolvedValue([])}
        launchSearch={vi.fn().mockResolvedValue(undefined)}
        persistence={{
          updateSettings: mocks.updateSettings,
          updateSearchState: mocks.updateSearchState,
          promoteTargetHandle: mocks.promoteTargetHandle,
        }}
      />,
    );
    await screen.findByLabelText('Keyword');

    unmount();

    expect(mocks.unwatchSettings).toHaveBeenCalledOnce();
    expect(mocks.unwatchSearchState).toHaveBeenCalledOnce();
    expect(mocks.unwatchHistory).toHaveBeenCalledOnce();
  });

  it.each([
    { label: 'Posts by me', direction: 'me-to-them', targetHandle: '@them', title: 'from:me to:them' },
    { label: 'Posts by me', direction: 'me-to-them', targetHandle: '', title: 'from:me' },
    { label: 'Posts to me', direction: 'them-to-me', targetHandle: '@them', title: 'from:them to:me' },
    { label: 'Posts to me', direction: 'them-to-me', targetHandle: '', title: 'to:me' },
    { label: 'Posts by other person', direction: 'from-profile', targetHandle: '@them', title: 'from:them' },
    { label: 'Mentions of other person', direction: 'mentions', targetHandle: '@them', title: '@them' },
  ] as const)('maps $label with target "$targetHandle" to $direction and its query preview', async ({
    label,
    direction,
    targetHandle,
    title,
  }) => {
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false });
    mocks.getSearchState.mockResolvedValue({ targetHandle, keyword: '', since: '', until: '' });
    const { launchSearch } = renderQuickSearch();

    const action = await screen.findByRole('button', { name: new RegExp(label) });
    await waitFor(() => expect(action).toBeEnabled());
    expect(action).toHaveAttribute('title', title);
    fireEvent.click(action);

    await waitFor(() => expect(launchSearch).toHaveBeenCalledWith(expect.objectContaining({
      direction,
      viewerHandle: '@me',
      targetHandle: targetHandle ? 'them' : '',
    })));
  });
});

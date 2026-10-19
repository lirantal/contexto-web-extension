import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextoSidebarWorkspace } from '@/src/ui/ContextoSidebarWorkspace';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { AccountSummary, XSearchFilters } from '@/src/shared/types';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  setSettings: vi.fn(),
  watchSettings: vi.fn(),
  getSearchState: vi.fn(),
  setSearchState: vi.fn(),
  watchSearchState: vi.fn(),
  getHistory: vi.fn(),
  watchHistory: vi.fn(),
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
}));

const alice: AccountSummary = {
  id: 'account_alice',
  platform: 'x',
  handle: 'alice_dev',
  normalizedHandle: 'alice_dev',
  displayName: 'Alice Example',
  profileUrl: 'https://x.com/alice_dev',
  syncState: 'local-only',
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
  company: {
    id: 'company_acme',
    name: 'Acme',
    normalizedName: 'acme',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  },
  tags: [],
  folders: [],
};

function isOpenSearch(message: unknown): message is { type: 'contexto:search:open'; filters: XSearchFilters } {
  return typeof message === 'object' && message !== null && 'type' in message
    && message.type === 'contexto:search:open';
}

function persistenceResponse(message: ContextoRequest): ContextoResponse | undefined {
  if (message.type === 'contexto:settings:update') {
    return {
      ok: true,
      settings: {
        myXHandle: message.patch.myXHandle ?? '@me',
        lastDashboardView: 'accounts',
        showNativeXSidebarWidgets: false,
      },
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
  return undefined;
}

describe('ContextoSidebarWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts', showNativeXSidebarWidgets: false });
    mocks.getSearchState.mockResolvedValue({ targetHandle: '', keyword: '', since: '', until: '' });
    mocks.getHistory.mockResolvedValue([]);
    mocks.setSettings.mockResolvedValue(undefined);
    mocks.setSearchState.mockResolvedValue(undefined);
    mocks.watchSettings.mockReturnValue(() => undefined);
    mocks.watchSearchState.mockReturnValue(() => undefined);
    mocks.watchHistory.mockReturnValue(() => undefined);
  });

  it('composes account search and Quick X search with saved-account suggestions', async () => {
    const user = userEvent.setup();
    const send = vi.fn(async (message) => {
      const persisted = persistenceResponse(message);
      if (persisted) return persisted;
      if (message.type === 'contexto:account:list') return { ok: true as const, accounts: [alice] };
      if (isOpenSearch(message)) return { ok: true as const };
      throw new Error('Unexpected request');
    });

    render(<ContextoSidebarWorkspace send={send} />);

    expect(await screen.findByRole('region', { name: 'Contexto account search' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Quick X search' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /collapse/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: "Other person's X handle" }));
    expect(await screen.findByRole('option', { name: /Alice Example.*@alice_dev.*Acme/i })).toBeVisible();

    await user.click(screen.getByRole('option', { name: /Alice Example.*@alice_dev.*Acme/i }));
    await waitFor(() => expect(send).toHaveBeenCalledWith({
      type: 'contexto:search-state:update',
      patch: { targetHandle: '@alice_dev' },
    }));
    await user.click(screen.getByRole('button', { name: /Posts by other person/ }));

    await waitFor(() => expect(send).toHaveBeenCalledWith({
      type: 'contexto:search:open',
      filters: expect.objectContaining({ direction: 'from-profile', targetHandle: 'alice_dev' }),
    }));
    await waitFor(() => expect(send).toHaveBeenCalledWith({
      type: 'contexto:target-history:promote',
      handle: 'alice_dev',
    }));

    const openCall = send.mock.calls.findIndex(([message]) => message.type === 'contexto:search:open');
    const promotionCall = send.mock.calls.findIndex(
      ([message]) => message.type === 'contexto:target-history:promote',
    );
    expect(send.mock.invocationCallOrder[openCall]).toBeLessThan(send.mock.invocationCallOrder[promotionCall]);
  });

  it('keeps free-form target search usable when saved accounts are unavailable', async () => {
    const user = userEvent.setup();
    const send = vi.fn(async (message) => {
      const persisted = persistenceResponse(message);
      if (persisted) return persisted;
      if (message.type === 'contexto:account:list') return { ok: false as const, error: 'Accounts unavailable' };
      if (isOpenSearch(message)) return { ok: true as const };
      throw new Error('Unexpected request');
    });

    render(<ContextoSidebarWorkspace send={send} />);

    const target = await screen.findByRole('combobox', { name: "Other person's X handle" });
    await user.type(target, '@freeform');
    expect(target).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Posts by other person/ }));

    await waitFor(() => expect(send).toHaveBeenCalledWith({
      type: 'contexto:search:open',
      filters: expect.objectContaining({ direction: 'from-profile', targetHandle: 'freeform' }),
    }));
  });
});

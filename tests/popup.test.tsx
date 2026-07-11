import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/entrypoints/popup/App';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  setSettings: vi.fn(),
  getSearchState: vi.fn(),
  setSearchState: vi.fn(),
}));

vi.mock('@/src/shared/settings', () => ({
  defaultSettings: { myXHandle: '', lastDashboardView: 'accounts' },
  defaultPopupSearchState: { targetHandle: '', keyword: '', since: '', until: '' },
  settingsItem: { getValue: mocks.getSettings, setValue: mocks.setSettings },
  popupSearchStateItem: { getValue: mocks.getSearchState, setValue: mocks.setSearchState },
}));

describe('popup search form', () => {
  beforeEach(() => {
    mocks.getSettings.mockResolvedValue({ myXHandle: '@me', lastDashboardView: 'accounts' });
    mocks.getSearchState.mockResolvedValue({
      targetHandle: '@them',
      keyword: 'security',
      since: '2026-01-01',
      until: '2026-02-01',
    });
    mocks.setSettings.mockResolvedValue(undefined);
    mocks.setSearchState.mockResolvedValue(undefined);
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

    await waitFor(() => expect(mocks.setSearchState).toHaveBeenCalledWith({
      targetHandle: '@them',
      keyword: 'typescript',
      since: '2026-01-01',
      until: '2026-02-01',
    }));
  });
});

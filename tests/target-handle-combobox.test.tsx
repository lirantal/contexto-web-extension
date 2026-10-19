import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TargetHandleCombobox } from '@/src/ui/TargetHandleCombobox';
import type { TargetHandleSuggestion } from '@/src/shared/target-handle-suggestions';

const suggestions: TargetHandleSuggestion[] = [
  {
    id: 'account_alice',
    handle: 'alice_dev',
    displayName: 'Alice Example',
    companyName: 'Acme',
    updatedAt: '2026-07-10T00:00:00Z',
    source: 'account',
    recent: true,
    searchedAt: '2026-07-11T00:00:00Z',
  },
  {
    handle: 'history_only',
    source: 'history',
    recent: true,
    searchedAt: '2026-07-10T00:00:00Z',
  },
];

function Harness({ availableSuggestions = suggestions }: { availableSuggestions?: TargetHandleSuggestion[] }) {
  const [value, setValue] = useState('');
  return <TargetHandleCombobox value={value} suggestions={availableSuggestions} onChange={setValue} />;
}

describe('TargetHandleCombobox', () => {
  it('opens an accessible rich list and preserves arbitrary typed text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: "Other person's X handle" });

    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeVisible();
    const option = screen.getByRole('option', { name: /Alice Example/ });
    expect(option).toHaveTextContent('@alice_dev');
    expect(within(option).getByText('Company:')).toBeVisible();
    expect(within(option).getByText('Acme')).toBeVisible();
    expect(screen.getAllByText('Recent')).toHaveLength(2);

    await user.type(input, 'pasted free text');
    expect(input).toHaveValue('pasted free text');
  });

  it('selects a highlighted suggestion with the keyboard and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: "Other person's X handle" });

    await user.click(input);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-0'));
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('@alice_dev');
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.click(input);
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('selects a history-only suggestion with the mouse', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: "Other person's X handle" });

    await user.click(input);
    await user.click(screen.getByRole('option', { name: /@history_only/ }));
    expect(input).toHaveValue('@history_only');
  });

  it('omits company labels for empty and whitespace-only suggestion values', async () => {
    const importedSuggestions: TargetHandleSuggestion[] = [
      { ...suggestions[0], id: 'empty_company', handle: 'empty_company', companyName: '' },
      { ...suggestions[0], id: 'blank_company', handle: 'blank_company', companyName: ' \t ' },
    ];
    render(<Harness availableSuggestions={importedSuggestions} />);

    await userEvent.click(screen.getByRole('combobox', { name: "Other person's X handle" }));

    for (const option of screen.getAllByRole('option')) {
      expect(within(option).queryByText('Company:')).not.toBeInTheDocument();
    }
  });

  it('preserves the original nonblank company text in a suggestion', async () => {
    render(<Harness availableSuggestions={[{ ...suggestions[0], companyName: '  Acme  ' }]} />);

    await userEvent.click(screen.getByRole('combobox', { name: "Other person's X handle" }));

    const companyValue = screen.getByRole('option').querySelector('.target-handle-company-value');
    expect(companyValue?.textContent).toBe('  Acme  ');
  });
});

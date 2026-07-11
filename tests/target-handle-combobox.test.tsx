import { useState } from 'react';
import { render, screen } from '@testing-library/react';
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

function Harness() {
  const [value, setValue] = useState('');
  return <TargetHandleCombobox value={value} suggestions={suggestions} onChange={setValue} />;
}

describe('TargetHandleCombobox', () => {
  it('opens an accessible rich list and preserves arbitrary typed text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: "Other person's X handle" });

    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeVisible();
    expect(screen.getByRole('option', { name: /Alice Example/ })).toHaveTextContent('@alice_dev');
    expect(screen.getByRole('option', { name: /Alice Example/ })).toHaveTextContent('Acme');
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
});

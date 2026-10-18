import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LocationCombobox } from '@/src/ui/LocationCombobox';

const suggestions = ['Berlin', 'San Fernando', 'San Francisco'];

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('');
  return <LocationCombobox value={value} suggestions={suggestions} onChange={setValue}
    disabled={disabled} />;
}

describe('LocationCombobox', () => {
  it('shows fuzzy matches and selects with wrapping arrow navigation', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Location' });

    await user.type(input, 'san');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: 'San Francisco' })).toBeVisible();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'San Fernando' }))
      .toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'San Francisco' }))
      .toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'San Fernando' }))
      .toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'San Francisco' }))
      .toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(input).toHaveValue('San Francisco');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('selects a suggestion with the pointer', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Location' });

    await user.type(input, 'san');
    await user.click(screen.getByRole('option', { name: 'San Fernando' }));

    expect(input).toHaveValue('San Fernando');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes with Escape without clearing free text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Location' });

    await user.type(input, 'sfr');
    await user.keyboard('{Escape}');

    expect(input).toHaveValue('sfr');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps unmatched text as a new location value', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Location' });

    await user.type(input, 'Lisbon');

    expect(input).toHaveValue('Lisbon');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes suggestions when disabled', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Location' });

    await user.type(input, 'san');
    expect(screen.getByRole('listbox')).toBeVisible();

    rerender(<Harness disabled />);

    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

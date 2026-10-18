import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FuzzyTextCombobox } from '@/src/ui/FuzzyTextCombobox';

const suggestions = ['Berlin', 'San Fernando', 'San Francisco'];

function Harness({ disabled = false, label = 'Location' }: { disabled?: boolean; label?: string }) {
  const [value, setValue] = useState('');
  return <FuzzyTextCombobox label={label} value={value} suggestions={suggestions} onChange={setValue}
    disabled={disabled} />;
}

function TabHarness() {
  const [value, setValue] = useState('');
  return <>
    <FuzzyTextCombobox label="Company" value={value} suggestions={suggestions} onChange={setValue} />
    <button type="button">Next field</button>
  </>;
}

describe('FuzzyTextCombobox', () => {
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

  it('uses its configurable label for the combobox', async () => {
    const user = userEvent.setup();
    render(<Harness label="Company" />);
    const input = screen.getByRole('combobox', { name: 'Company' });

    await user.type(input, 'sfr');

    expect(screen.getByRole('option', { name: 'San Francisco' })).toBeVisible();
  });

  it('scrolls the active option within a Shadow DOM editor', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    shadow.append(mount);
    document.body.append(host);
    const view = render(<Harness />, { container: mount });
    const input = view.getByRole('combobox', { name: 'Location' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'san' } });
    const firstOption = view.getByRole('option', { name: 'San Fernando' });
    firstOption.scrollIntoView = vi.fn();
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(firstOption.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    view.unmount();
    host.remove();
  });

  it('keeps suggestions out of the Tab order', async () => {
    const user = userEvent.setup();
    render(<TabHarness />);
    const input = screen.getByRole('combobox', { name: 'Company' });

    await user.type(input, 'san');
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('tabindex', '-1');
    }

    await user.tab();

    expect(screen.getByRole('button', { name: 'Next field' })).toHaveFocus();
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

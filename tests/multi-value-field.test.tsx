import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MultiValueField, type MultiValueFieldProps } from '@/src/ui/MultiValueField';

const suggestions = ['YouTuber', 'YouTube Creator', 'Developer'];

function Harness({ label = 'Tags' }: { label?: MultiValueFieldProps['label'] }) {
  const [values, setValues] = useState<string[]>([]);
  return <MultiValueField label={label} values={values} suggestions={suggestions} onChange={setValues} />;
}

describe('MultiValueField', () => {
  it('shows only existing matches and selects the highlighted option with wrapping arrow navigation', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Tags' });

    await user.type(input, 'you');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'YouTuber' })).toHaveClass('value-option');
    expect(screen.getByRole('option', { name: 'YouTube Creator' })).toBeVisible();
    expect(screen.queryByText(/create/i)).not.toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-0'));
    expect(screen.getByRole('option', { name: 'YouTuber' }))
      .toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'YouTuber' })).toHaveClass('highlighted');

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-1'));

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-0'));

    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-1'));

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-0'));

    await user.keyboard('{Enter}');
    expect(input).toHaveValue('');
    expect(screen.getByText('YouTuber')).toBeVisible();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('creates the typed value with Enter when no existing suggestion is active', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Tags' });

    await user.type(input, 'New Tag{Enter}');

    expect(screen.getByText('New Tag')).toBeVisible();
    expect(input).toHaveValue('');
  });

  it('closes with Escape without clearing the typed query', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Tags' });

    await user.type(input, 'you');
    await user.keyboard('{Escape}');

    expect(input).toHaveValue('you');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('uses the same custom suggestion behavior for Folders and supports pointer selection', async () => {
    const user = userEvent.setup();
    render(<Harness label="Folders" />);
    const input = screen.getByRole('combobox', { name: 'Folders' });

    await user.type(input, 'you');
    const option = screen.getByRole('option', { name: 'YouTuber' });
    await user.hover(option);
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(option).toHaveClass('highlighted');
    await user.click(option);

    expect(screen.getByText('YouTuber')).toBeVisible();
    expect(input).toHaveValue('');
  });

  it('hides open suggestions when the field becomes disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<MultiValueField label="Tags" values={[]} suggestions={suggestions}
      onChange={onChange} disabled={false} />);
    const input = screen.getByRole('combobox', { name: 'Tags' });

    await user.type(input, 'you');
    expect(screen.getByRole('listbox')).toBeVisible();
    rerender(<MultiValueField label="Tags" values={[]} suggestions={suggestions}
      onChange={onChange} disabled />);

    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    rerender(<MultiValueField label="Tags" values={[]} suggestions={suggestions}
      onChange={onChange} disabled={false} />);
    expect(input).toBeEnabled();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not navigate or select suggestions before a query is typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Tags' });

    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(input).toHaveValue('');
    expect(screen.queryByText('YouTuber')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});

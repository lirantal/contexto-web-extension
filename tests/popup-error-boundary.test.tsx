import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PopupErrorBoundary } from '@/entrypoints/popup/PopupErrorBoundary';

function Broken(): never {
  throw new Error('render exploded');
}

describe('PopupErrorBoundary', () => {
  it('shows a recovery state instead of a blank popup', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });

    render(<PopupErrorBoundary><Broken /></PopupErrorBoundary>);

    expect(screen.getByRole('alert')).toHaveTextContent('Contexto could not open');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { BackupControls } from '../src/ui/BackupControls';
import { canonicalRecord } from '../src/data/record-revision';
import { backupTables } from '../src/data/backup-validation';

const mocks = vi.hoisted(() => ({ exportBackup: vi.fn(), importBackup: vi.fn(), previewBackup: vi.fn() }));
vi.mock('../src/data/repositories', () => mocks);
const data = Object.fromEntries(backupTables.map((table) => [table, []]));
const envelope = { app: 'Contexto', formatVersion: 2, exportedAt: '2026-01-01T00:00:00Z', data };
const preview = { envelope, added: 2, unchanged: 1, conflicts: 0, currentRecords: 3, incomingRecords: 3, databaseRevision: canonicalRecord(data) };
function select(content = '{}') {
  fireEvent.change(screen.getByLabelText('Import'), { target: { files: [{ text: async () => content }] } });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.exportBackup.mockResolvedValue(envelope); mocks.previewBackup.mockResolvedValue(preview); mocks.importBackup.mockResolvedValue(undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:backup'); static revokeObjectURL = vi.fn(); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('shows invalid JSON errors and makes no writes', async () => {
  render(<BackupControls />); select('invalid JSON');
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(mocks.importBackup).not.toHaveBeenCalled();
  expect(mocks.previewBackup).not.toHaveBeenCalled();
});
it('requires a recovery download and explicit file verification before safe merge', async () => {
  const user = userEvent.setup(); render(<BackupControls />); select();
  const apply = await screen.findByRole('button', { name: 'Merge backup safely' });
  expect(apply).toBeDisabled();
  const confirmation = screen.getByRole('checkbox'); expect(confirmation).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Download recovery backup' }));
  expect(confirmation).toBeEnabled(); expect(apply).toBeDisabled();
  await user.click(confirmation); await user.click(apply);
  expect(mocks.importBackup).toHaveBeenCalledWith(envelope, undefined, { mode: 'merge', expectedDatabaseRevision: preview.databaseRevision });
  expect(await screen.findByText('Backup merged without overwriting saved records.')).toBeVisible();
});
it('blocks conflicting merges and explains the explicit full restore', async () => {
  mocks.previewBackup.mockResolvedValue({ ...preview, conflicts: 1 });
  const user = userEvent.setup(); render(<BackupControls />); select();
  await screen.findByRole('group', { name: 'Import preview' });
  await user.click(screen.getByRole('button', { name: 'Download recovery backup' }));
  await user.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Merge backup safely' })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('Import mode'), 'restore');
  expect(screen.getByText(/Data absent from the backup is removed/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Replace database with this backup' }));
  expect(mocks.importBackup).toHaveBeenCalledWith(envelope, undefined, { mode: 'restore', expectedDatabaseRevision: preview.databaseRevision });
});
it('cancels a preview without importing', async () => {
  const user = userEvent.setup(); render(<BackupControls />); select();
  await user.click(await screen.findByRole('button', { name: 'Cancel import' }));
  expect(screen.queryByRole('group', { name: 'Import preview' })).not.toBeInTheDocument();
  expect(mocks.importBackup).not.toHaveBeenCalled();
});
it('requires a fresh preview when local data changes before the recovery export', async () => {
  mocks.exportBackup.mockResolvedValue({ ...envelope, data: { ...data, notes: [{ id: 'new' }] } });
  const user = userEvent.setup(); render(<BackupControls />); select();
  await user.click(await screen.findByRole('button', { name: 'Download recovery backup' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Local data changed');
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(mocks.importBackup).not.toHaveBeenCalled();
});
it('retains the preview and shows errors if import fails', async () => {
  mocks.importBackup.mockRejectedValue(new Error('Local data changed since preview'));
  const user = userEvent.setup(); render(<BackupControls />); select();
  await user.click(await screen.findByRole('button', { name: 'Download recovery backup' }));
  await user.click(screen.getByRole('checkbox')); await user.click(screen.getByRole('button', { name: 'Merge backup safely' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Local data changed');
  expect(screen.getByRole('group', { name: 'Import preview' })).toBeVisible();
});
it('shows export failures without reporting a successful backup', async () => {
  mocks.exportBackup.mockRejectedValue(new Error('Disk read failed'));
  const user = userEvent.setup(); render(<BackupControls />);
  await user.click(screen.getByRole('button', { name: 'Export' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Disk read failed');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled());
  expect(screen.queryByText(/Backup download requested/)).not.toBeInTheDocument();
});

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Uses only a disposable browser profile and synthetic relationship data.
const temporary = await mkdtemp(join(tmpdir(), 'contexto-integrity-'));
const extension = resolve('.output/chrome-mv3');
let context;
async function launch() {
  return chromium.launchPersistentContext(join(temporary, 'profile'), {
    channel: 'chromium', headless: true, acceptDownloads: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
}
const stamp = '2026-01-01T00:00:00.000Z';
const account = { id: 'account_fixture', platform: 'x', handle: 'integrity_test', normalizedHandle: 'integrity_test',
  followersCount: 0, followingCount: 42, followersCountObservedAt: stamp, followingCountObservedAt: stamp,
  followsYou: false, followsYouViewerHandle: 'viewer', followsYouViewerId: '123', followsYouObservedAt: stamp,
  displayName: 'Integrity fixture', profileUrl: 'https://x.com/integrity_test', role: 'Engineer',
  createdAt: stamp, updatedAt: stamp, syncState: 'local-only', futureContext: { retained: ['unknown field'] } };
const note = { id: 'note_fixture', accountId: account.id, body: 'Preserve this context', createdAt: stamp, updatedAt: stamp };
const data = { accounts: [account], companies: [], tags: [], accountTags: [], folders: [], folderAccounts: [], notes: [note],
  bookmarks: [], searchPresets: [], searchHistory: [], backups: [], changeLog: [] };
const envelope = { app: 'Contexto', formatVersion: 2, exportedAt: stamp, data };
async function selectBackup(page) {
  await page.getByLabel('Import', { exact: true }).setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(envelope)) });
  await expect(page.getByRole('group', { name: 'Import preview' })).toBeVisible();
}
async function recovery(page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery backup' }).click();
  const file = await downloading;
  const destination = join(temporary, file.suggestedFilename());
  await file.saveAs(destination);
  const parsed = JSON.parse(await readFile(destination, 'utf8'));
  assert.equal(parsed.app, 'Contexto');
  await page.getByRole('checkbox', { name: 'I verified that the recovery JSON file was saved' }).check();
  return parsed;
}
async function exported(page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const file = await downloading;
  const destination = join(temporary, file.suggestedFilename());
  await file.saveAs(destination);
  return JSON.parse(await readFile(destination, 'utf8'));
}
try {
  context = await launch();
  await context.route(/^https?:/, (route) => route.abort());
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const optionsUrl = new URL('options.html', worker.url()).href;
  const page = await context.newPage();
  await page.goto(optionsUrl);
  await selectBackup(page);
  const empty = await recovery(page);
  assert.equal(empty.data.accounts.length, 0);
  await page.getByRole('button', { name: 'Merge backup safely' }).click();
  await expect(page.getByText('Backup merged without overwriting saved records.')).toBeVisible();
  await expect(page.getByLabel('Role', { exact: true })).toHaveValue('Engineer');
  const firstExport = await exported(page);
  assert.deepEqual(firstExport.data.accounts, [account]);
  assert.deepEqual(firstExport.data.notes, [note]);

  const other = await context.newPage();
  await other.goto(optionsUrl);
  await other.getByLabel('Role', { exact: true }).fill('Updated elsewhere');
  await other.getByRole('button', { name: 'Save metadata', exact: true }).click();
  await expect(other.getByRole('button', { name: 'Save metadata', exact: true })).toBeEnabled();
  await page.getByLabel('Role', { exact: true }).fill('Stale draft');
  await page.getByRole('button', { name: 'Save metadata', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Contact changed');
  await expect(page.getByLabel('Role', { exact: true })).toHaveValue('Stale draft');
  await page.getByRole('button', { name: 'Reload saved values' }).click();
  await expect(page.getByLabel('Role', { exact: true })).toHaveValue('Updated elsewhere');

  await page.getByPlaceholder('@handle', { exact: true }).fill('extra_fixture');
  await page.getByRole('button', { name: 'Add account', exact: true }).click();
  await expect(page.getByText('Added @extra_fixture')).toBeVisible();
  await selectBackup(page);
  await expect(page.getByRole('button', { name: 'Merge backup safely' })).toBeDisabled();
  await page.getByLabel('Import mode').selectOption('restore');
  const beforeRestore = await recovery(page);
  assert.equal(beforeRestore.data.accounts.length, 2);
  await page.getByRole('button', { name: 'Replace database with this backup' }).click();
  await expect(page.getByText('Database restored from backup.')).toBeVisible();
  const restored = await exported(page);
  assert.deepEqual(restored.data.accounts, [account]);
  assert.deepEqual(restored.data.notes, [note]);
  await context.close(); context = undefined;

  context = await launch();
  await context.route(/^https?:/, (route) => route.abort());
  const reopened = await context.newPage();
  await reopened.goto(optionsUrl);
  await expect(reopened.getByLabel('Role', { exact: true })).toHaveValue('Engineer');
  const afterRestart = await exported(reopened);
  assert.deepEqual(afterRestart.data.accounts, [account]);
  assert.deepEqual(afterRestart.data.notes, [note]);
  console.log('Built-extension integrity verified: real JSON downloads, safe merge, stale drafts, full restore, unknown fields, and browser restart.');
} finally {
  await context?.close();
  await rm(temporary, { recursive: true, force: true });
}

import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../scripts/x-lists/run.mjs';
import { loadLocalEnv } from '../scripts/x-lists/env.mjs';
import { callbackCode, authenticatedRequester, authorize, promptManualCallback, apiFailureMessage, REDIRECT_URI, SCOPES } from '../scripts/x-lists/auth.mjs';
import { readJson, writeJson, withLock } from '../scripts/x-lists/files.mjs';
import { appendDiscovery, appendMembers, convertArchive, newArchive, report, scaffoldMapping,
  applyExportConfig, validateExportConfig } from '../scripts/x-lists/core.mjs';
import { validateBackup } from '../src/data/backup-validation';
import { ContextoDatabase } from '../src/data/db';
import { exportBackup, importBackup, previewBackup } from '../src/data/repositories';

// The SDK captures fetch in a module-level HTTP singleton: intercept before import.
const sdkFetch = vi.hoisted(() => {
  const fetch = vi.fn(async () => { throw new Error('Unexpected network request in offline test'); });
  globalThis.fetch = fetch;
  return fetch;
});
const directories = [];
const databases = [];
const time = '2026-10-20T12:00:00.000Z';
const user = { id: '1234567890123456789', name: 'Developer', username: 'Dev', created_at: '2010-01-01T00:00:00Z',
  description: 'A bio', entities: { url: { urls: [{ expanded_url: 'https://example.org' }] } },
  public_metrics: { followers_count: 42 }, future_field: { keep: true } };
const list = (id, name = 'DevRels') => ({ id, name, private: true, member_count: 1 });
function completeArchive() {
  const archive = newArchive({ id: '99', username: 'owner' }, time);
  appendDiscovery(archive, { data: [list('1'), list('2', 'Speakers'), { ...list('3', 'Empty'), member_count: 0 }] }, time);
  appendMembers(archive.lists['1'], { data: [user] }, time);
  appendMembers(archive.lists['2'], { data: [user] }, time);
  appendMembers(archive.lists['3'], { data: [] }, time);
  return archive;
}
async function temp() { const dir = await mkdtemp(join(tmpdir(), 'contexto-x-test-')); directories.push(dir); return dir; }
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  sdkFetch.mockReset();
  await Promise.all(databases.splice(0).map((db) => db.delete()));
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('standalone X List export', () => {
  it('promotes API audience and viewer relationships without inventing unknowns', () => {
    const archive = completeArchive();
    archive.lists['1'].pages[0].body.data = [{ ...user, connection_status: ['followed_by'], public_metrics: { followers_count: 0, following_count: 2729 } }];
    archive.lists['2'].pages[0].body.data = [user];
    const account = validateBackup(convertArchive(archive, scaffoldMapping(archive), time)).data.accounts[0];
    expect(account).toMatchObject({ followersCount: 42, followingCount: 2729, followsYou: true,
      followsYouViewerHandle: 'owner', followsYouViewerId: '99', followsYouObservedAt: time });
    const noStatus = structuredClone(completeArchive());
    expect(convertArchive(noStatus, scaffoldMapping(noStatus), time).data.accounts[0].followsYou).toBeUndefined();
    for (const entry of Object.values(noStatus.lists)) for (const page of entry.pages) for (const value of page.body.data ?? []) value.connection_status = [];
    expect(convertArchive(noStatus, scaffoldMapping(noStatus), time).data.accounts[0].followsYou).toBe(false);
  });
  it('quietly loads optional env files with shell and export-file precedence', async () => {
    const dir = await temp();
    const base = join(dir, '.env'); const specific = join(dir, '.env.x-export');
    await writeFile(specific, 'X_CLIENT_ID="test-client"\n');
    const env = {};
    await loadLocalEnv({ files: [base, specific], env });
    expect(env.X_CLIENT_ID).toBe('test-client');
    await writeFile(base, 'X_CLIENT_ID=base-client\nBASE_ONLY=yes\n');
    const merged = { SHELL_ONLY: 'yes' };
    await loadLocalEnv({ files: [base, specific], env: merged });
    expect(merged).toMatchObject({ X_CLIENT_ID: 'test-client', BASE_ONLY: 'yes', SHELL_ONLY: 'yes' });
    const shell = { X_CLIENT_ID: 'shell-client' };
    await loadLocalEnv({ files: [base, specific], env: shell });
    expect(shell.X_CLIENT_ID).toBe('shell-client');
  });

  it('runs CLI help without missing-env notices when only the export env file exists', async () => {
    const dir = await temp();
    await writeFile(join(dir, '.env.x-export'), 'X_CLIENT_ID=test-client\n');
    const cli = resolve('scripts/x-lists/cli.mjs');
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [cli, '--help'], { cwd: dir });
    expect(stdout).toContain('Standalone X private Lists export');
    expect(stdout).not.toMatch(/not found|test-client/);
    expect(stderr).toBe('');
  });
  it('explains developer-app enrollment failures without exposing the API payload', async () => {
    const error = { status: 403, data: { type: 'https://api.x.com/2/problems/client-forbidden',
      reason: 'client-not-enrolled', client_id: 'private-client',
      detail: 'The app must be attached to a Project. private-token', title: 'private-title',
      access_token: 'private-token' } };
    const message = apiFailureMessage(error, 'GET /2/users/me');
    expect(message).toContain('client-not-enrolled');
    expect(message).toContain('GET /2/users/me');
    expect(message).toContain('attached to a Project');
    expect(message).not.toMatch(/private-client|private-token|private-title/);
    vi.stubEnv('X_CLIENT_ID', 'test-client');
    const save = vi.fn();
    const request = authenticatedRequester({ version: 1, clientId: 'test-client', tokens: { access_token: 'private-token' },
      expiresAt: Date.now() + 3600_000 }, save);
    await expect(request(async () => { throw error; }, 'GET /2/users/me')).rejects.toThrow(message);
    expect(save).not.toHaveBeenCalled();
    expect(apiFailureMessage({ status: 403, data: { type: 'private-token', detail: 'private-token' } })).not.toContain('private-token');
  });
  it('excludes Lists by normalized exact name from completion, costs, mapping, and import without erasing raw data', () => {
    const archive = completeArchive();
    archive.lists['2'].complete = false;
    applyExportConfig(archive, { version: 1, skipListNames: ['  sPeAkErS  '] });
    expect(report(archive)).toMatchObject({ complete: true, selectedLists: 2, excludedLists: 1,
      memberships: 1, estimatedMembershipReadUpperBoundUSD: 0.01 });
    const mapping = scaffoldMapping(archive);
    expect(mapping.lists['2']).toBeUndefined();
    const converted = convertArchive(archive, mapping, time);
    expect(converted.data.folders.map((circle) => circle.name)).not.toContain('Speakers');
    expect(converted.data.accounts[0].xImport.profiles).toHaveLength(1);
    expect(archive.lists['2'].pages[0].body.data[0]).toEqual(user);
    applyExportConfig(archive, { version: 1, skipListNames: [] });
    expect(report(archive).complete).toBe(false);
  });

  it('matches duplicate List names but never substrings, and reports unmatched rules', () => {
    const archive = completeArchive();
    archive.lists['2'].list.name = '  DevRels ';
    archive.lists['3'].list.name = 'DevRels community';
    applyExportConfig(archive, { version: 1, skipListNames: ['devrels'] });
    expect(report(archive)).toMatchObject({ excludedLists: 2, selectedLists: 1, uniqueUsers: 0 });
    applyExportConfig(archive, { version: 1, skipListNames: ['typo'] });
    expect(report(archive)).toMatchObject({ complete: false, unmatchedSkipListNames: ['typo'] });
    for (const config of [{ version: 2, skipListNames: [] }, { version: 1, skipListNames: 'DevRels' },
      { version: 1, skipListNames: [' '] }, { version: 1, skipListNames: [12] }]) {
      expect(() => validateExportConfig(config)).toThrow('Export config');
    }
  });

  it('authorizes a container via a manually supplied callback using the official SDK and PKCE', async () => {
    vi.stubEnv('X_CLIENT_ID', 'test-client');
    const saved = vi.fn(); const log = vi.fn();
    const fetchMock = vi.fn(async (input, init) => {
      expect(String(input)).toBe('https://api.x.com/2/oauth2/token');
      const body = new URLSearchParams(init.body);
      expect(body.get('redirect_uri')).toBe(REDIRECT_URI);
      expect(body.get('code')).toBe('short-lived-code');
      expect(body.get('code_verifier').length).toBeGreaterThanOrEqual(43);
      expect(body.get('client_secret')).toBeNull();
      return json({ access_token: 'secret-access', refresh_token: 'secret-refresh', expires_in: 7200,
        token_type: 'bearer', scope: SCOPES.join(' ') });
    });
    vi.stubGlobal('fetch', fetchMock);
    await authorize(saved, log, { manual: true, readCallback: async ({ signal }) => {
      expect(signal.aborted).toBe(false);
      const authUrl = new URL(log.mock.calls[1][0]);
      expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
      expect(authUrl.searchParams.get('scope').split(' ')).toEqual(SCOPES);
      return `${REDIRECT_URI}?state=${authUrl.searchParams.get('state')}&code=short-lived-code`;
    } });
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ tokens: expect.objectContaining({ access_token: 'secret-access' }) }));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/short-lived-code|secret-access|secret-refresh/);
  });

  it('rejects manual callbacks with another origin/state before exchanging or saving tokens', async () => {
    vi.stubEnv('X_CLIENT_ID', 'test-client');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const saved = vi.fn(); const log = vi.fn();
    await expect(authorize(saved, log, { manual: true, readCallback: async () => `${REDIRECT_URI}?state=wrong&code=private-code` }))
      .rejects.toThrow('Invalid callback');
    expect(() => callbackCode(new URL('https://other.example/callback?state=s&code=c'), 's')).toThrow('origin');
    expect(fetchMock).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-code');
  });

  it('hides pasted callback input in the terminal output', async () => {
    const input = new PassThrough(); const output = new PassThrough();
    let displayed = ''; output.on('data', (chunk) => { displayed += chunk; });
    const result = promptManualCallback({ input, output });
    input.write(`${REDIRECT_URI}?state=private-state&code=private-code\n`);
    expect(await result).toContain('private-code');
    expect(displayed).toContain('(hidden)'); expect(displayed).not.toMatch(/private-state|private-code/);
    input.destroy(); output.destroy();
  });

  it('cancels the manual prompt when terminal input closes', async () => {
    const input = new PassThrough(); const output = new PassThrough();
    const result = promptManualCallback({ input, output });
    input.end();
    await expect(result).rejects.toThrow('cancelled');
    input.destroy(); output.destroy();
  });

  it('deduplicates overlapping members and labels, preserves all metadata, and restores through the actual importer', async () => {
    const archive = completeArchive();
    const mapping = scaffoldMapping(archive);
    mapping.lists['1'].circles = ['DevRel', ' Friends '];
    mapping.lists['1'].tags = ['OSS'];
    mapping.lists['2'].circles = ['Speakers', 'friends'];
    mapping.lists['2'].tags = ['oss'];
    const backup = convertArchive(archive, mapping, time);
    expect(validateBackup(backup)).toEqual(backup);
    expect(backup.data.accounts).toHaveLength(1);
    expect(backup.data.tags).toHaveLength(1);
    expect(backup.data.folderAccounts).toHaveLength(3);
    expect(backup.data.accountTags).toHaveLength(1);
    expect(backup.data.accounts[0]).toMatchObject({ xUserId: user.id, website: 'https://example.org', createdAt: time,
      xImport: { profiles: [{ user }, { user }] } });
    expect(backup.data.folders.map((circle) => circle.name)).toContain('Empty');
    const db = new ContextoDatabase(`XImport-${Date.now()}`); databases.push(db);
    const preview = await previewBackup(backup, db);
    await importBackup(backup, db, { mode: 'restore', expectedDatabaseRevision: preview.databaseRevision });
    expect((await exportBackup(db)).data.accounts).toEqual(backup.data.accounts);
    expect(convertArchive(archive, mapping, time)).toEqual(backup);
  });

  it('preserves mapping edits and skips excluded Lists without modifying export data', () => {
    const archive = completeArchive();
    const mapping = scaffoldMapping(archive);
    mapping.lists['1'] = { listName: 'Custom label', circles: [], tags: ['Security'], skip: true, extra: 'keep' };
    expect(scaffoldMapping(archive, mapping).lists['1']).toEqual(mapping.lists['1']);
    mapping.lists['2'].skip = true;
    expect(convertArchive(archive, mapping, time).data.accounts).toHaveLength(0);
    expect(report(archive).uniqueUsers).toBe(1);
    delete mapping.lists['3'];
    expect(() => convertArchive(archive, mapping, time)).toThrow('Missing mapping');
  });

  it('blocks incomplete/error conversions, retains error attempts, and recovers a checkpoint on retry', () => {
    const archive = newArchive({ id: '99' }, time);
    appendDiscovery(archive, { data: [list('1')], meta: { next_token: 'next-list-page' } }, time);
    expect(() => convertArchive(archive, scaffoldMapping(archive), time)).toThrow('incomplete');
    appendDiscovery(archive, { data: [] }, time);
    const entry = archive.lists['1'];
    appendMembers(entry, { data: [user], errors: [{ detail: 'Partial API error' }] }, time);
    expect(entry.nextToken).toBeUndefined();
    expect(report(archive).complete).toBe(false);
    appendMembers(entry, { data: [user], meta: { next_token: 'next-members' } }, time);
    appendMembers(entry, { data: [] }, time);
    expect(report(archive)).toMatchObject({ complete: true, uniqueUsers: 1 });
    expect(entry.pages[0].body.errors).toHaveLength(1);
    expect(convertArchive(archive, scaffoldMapping(archive), time).data.accounts[0].xImport.profiles).toHaveLength(1);
  });

  it('rejects repeated pagination, unsafe IDs, unavailable handles, and identity collisions', () => {
    const archive = completeArchive();
    archive.lists['1'].pages[0].body.data.push({ ...user, id: '456' });
    expect(() => convertArchive(archive, scaffoldMapping(archive), time)).toThrow('Conflicting identities');
    archive.lists['1'].pages[0].body.data = [{ id: user.id }];
    expect(() => convertArchive(archive, scaffoldMapping(archive), time)).toThrow('usable handle');
    const empty = newArchive({ id: '99' }, time);
    appendDiscovery(empty, { data: [], meta: { next_token: 'a' } }, time);
    expect(() => appendDiscovery(empty, { data: [], meta: { next_token: 'a' } }, time)).toThrow('repeated');
    expect(() => newArchive({ id: 123 }, time)).toThrow('numeric');
  });

  it('runs discovery/export through the official SDK, resumes pagination, and converts offline', async () => {
    const dir = await temp();
    vi.stubEnv('X_CLIENT_ID', 'test-client');
    await writeJson(join(dir, 'config.json'), { version: 1, skipListNames: [' speakers '] });
    await writeJson(join(dir, 'tokens.json'), { version: 1, clientId: 'test-client', tokens: { access_token: 'test-token' }, expiresAt: Date.now() + 3600_000 });
    const calls = [];
    const fetchMock = vi.fn(async (input, init) => {
      const url = new URL(String(input)); calls.push(url);
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-token');
      if (url.pathname === '/2/users/me') return json({ data: { id: '99', username: 'owner' } });
      if (url.pathname === '/2/users/99/owned_lists') {
        expect(url.searchParams.get('list.fields')).toContain('private');
        return url.searchParams.has('pagination_token')
          ? json({ data: [list('2', 'Speakers')] })
          : json({ data: [list('1'), { ...list('8'), private: false }], meta: { next_token: 'more-lists' } });
      }
      if (url.pathname === '/2/lists/1/members') {
        expect(url.searchParams.get('user.fields')).toContain('public_metrics');
        expect(url.searchParams.has('expansions')).toBe(false);
        return url.searchParams.has('pagination_token') ? json({ data: [] })
          : json({ data: [user], meta: { next_token: 'more-members' } });
      }
      if (url.pathname === '/2/lists/2/members') return json({ data: [user] });
      throw new Error(`Unexpected endpoint: ${url.pathname}`);
    });
    sdkFetch.mockImplementation(fetchMock);
    vi.stubGlobal('fetch', fetchMock); vi.spyOn(console, 'log').mockImplementation(() => {});
    await main(['discover', '--dir', dir]);
    const beforeExcluded = calls.length;
    await expect(main(['export', '--dir', dir, '--list-id', '2', '--max-pages', '1'])).rejects.toThrow('excluded');
    expect(calls.slice(beforeExcluded).every((url) => url.pathname === '/2/users/me')).toBe(true);
    await main(['export', '--dir', dir, '--max-pages', '1']);
    expect(report(await readJson(join(dir, 'archive.json'))).complete).toBe(false);
    await expect(main(['convert', '--dir', dir])).rejects.toThrow('incomplete');
    await main(['export', '--dir', dir, '--max-pages', '5']);
    expect(calls.filter((url) => url.pathname === '/2/lists/1/members')).toHaveLength(2);
    expect(calls.filter((url) => url.pathname === '/2/lists/2/members')).toHaveLength(0);
    expect(report(await readJson(join(dir, 'archive.json')))).toMatchObject({ complete: true, excludedLists: 1 });
    expect((await readJson(join(dir, 'archive.json'))).lists['8']).toBeUndefined();
    const count = fetchMock.mock.calls.length;
    await main(['mapping', '--dir', dir]); await main(['convert', '--dir', dir]);
    expect(fetchMock).toHaveBeenCalledTimes(count);
    expect(validateBackup(await readJson(join(dir, 'contexto-import.contexto-backup.json'))).data.accounts).toHaveLength(1);
    expect((await stat(join(dir, 'tokens.json'))).mode & 0o777).toBe(0o600);
    await expect(main(['export', '--dir', dir])).rejects.toThrow('max-pages');
    await writeJson(join(dir, 'config.json'), { version: 1, skipListNames: ['Typo'] });
    const beforeTypo = calls.length;
    await expect(main(['export', '--dir', dir, '--max-pages', '1'])).rejects.toThrow('do not match');
    expect(calls.slice(beforeTypo).every((url) => url.pathname === '/2/users/me')).toBe(true);
    await writeJson(join(dir, 'config.json'), { version: 1, skipListNames: [] });
    await main(['export', '--dir', dir, '--max-pages', '1']);
    expect(calls.filter((url) => url.pathname === '/2/lists/2/members')).toHaveLength(1);
  });

  it('creates the exclusion scaffold offline and preserves existing config edits', async () => {
    const dir = await temp(); const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock); vi.spyOn(console, 'log').mockImplementation(() => {});
    await main(['config', '--dir', dir]);
    expect(await readJson(join(dir, 'config.json'))).toEqual({ version: 1, skipListNames: [] });
    const edited = { version: 1, skipListNames: ['Private group'], customField: 'keep' };
    await writeJson(join(dir, 'config.json'), edited);
    await main(['config', '--dir', dir]);
    expect(await readJson(join(dir, 'config.json'))).toEqual(edited);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks callback state and code and persists rotated tokens before a request', async () => {
    expect(callbackCode(new URL(`${REDIRECT_URI}?state=correct&code=code`), 'correct')).toBe('code');
    expect(() => callbackCode(new URL(`${REDIRECT_URI}?state=wrong&code=code`), 'correct')).toThrow('state');
    expect(() => callbackCode(new URL(`${REDIRECT_URI}?state=correct&error=access_denied`), 'correct')).toThrow('denied');
    vi.stubEnv('X_CLIENT_ID', 'test-client');
    const saved = vi.fn();
    const fetchMock = vi.fn(async (input, init) => {
      expect(String(input)).toContain('/oauth2/token');
      expect(String(init.body)).toContain('refresh_token');
      return json({ access_token: 'rotated', refresh_token: 'rotated-refresh', expires_in: 7200, token_type: 'bearer', scope: SCOPES.join(' ') });
    });
    vi.stubGlobal('fetch', fetchMock);
    const request = authenticatedRequester({ version: 1, clientId: 'test-client', tokens: {
      access_token: 'expired', refresh_token: 'old-refresh' }, expiresAt: 1 }, saved);
    await request(async () => { expect(saved).toHaveBeenCalledWith(expect.objectContaining({
      tokens: expect.objectContaining({ refresh_token: 'rotated-refresh' }),
    })); });
  });

  it('handles bounded rate limits without printing SDK payloads', async () => {
    vi.stubEnv('X_CLIENT_ID', 'test-client');
    const sleep = vi.fn(); const log = vi.fn();
    const request = authenticatedRequester({ version: 1, clientId: 'test-client',
      tokens: { access_token: 'token' }, expiresAt: Date.now() + 3600_000 }, vi.fn(), { sleep, log });
    const operation = vi.fn().mockRejectedValueOnce({ status: 429, headers: new Headers({ 'retry-after': '1' }), data: 'secret' }).mockResolvedValue('done');
    expect(await request(operation)).toBe('done'); expect(sleep).toHaveBeenCalledWith(1000);
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    await expect(request(async () => { throw { status: 429, headers: new Headers({ 'retry-after': '900' }) }; })).rejects.toThrow('Checkpoint retained');
  });

  it('locks writers and avoids exposing malformed token-file contents', async () => {
    const dir = await temp();
    await withLock(dir, async () => {
      await expect(withLock(dir, async () => {})).rejects.toThrow('Another command');
    });
    await writeFile(join(dir, 'broken.json'), '{secret-token:bad}');
    await expect(readJson(join(dir, 'broken.json'))).rejects.toThrow('Invalid JSON');
    await expect(readJson(join(dir, 'broken.json'))).rejects.not.toThrow('secret-token');
    expect(await readJson(join(dir, 'missing.json'), { fallback: true })).toEqual({ fallback: true });
  });
});

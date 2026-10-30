import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJson, writeJson, withLock } from './files.mjs';
import { authorize, authenticatedRequester } from './auth.mjs';
import { LIST_FIELDS, USER_FIELDS, requireId, newArchive, validateArchive, appendDiscovery,
  appendMembers, report, scaffoldMapping, convertArchive, DEFAULT_EXPORT_CONFIG,
  validateExportConfig, applyExportConfig, isListExcluded } from './core.mjs';

const HELP = `Standalone X private Lists export (Node 22+)
  npm run x:lists -- auth
  npm run x:lists -- auth --manual  (container/remote terminal; no port forwarding)
  npm run x:lists -- config  (create config.json skipListNames before member download)
  npm run x:lists -- discover
  npm run x:lists -- export --max-pages 1
  npm run x:lists -- export --max-pages 100
  npm run x:lists -- mapping
  npm run x:lists -- convert
  npm run x:lists -- report
Options: --dir DIRECTORY (default .local/x-lists), --max-pages N (member pages per run),
         --list-id ID (sample/resume just this discovered List), --manual (auth only), --help
Discovery and export incur API charges. Conversion and mapping work offline.
Do not run concurrently. Full restore in Contexto replaces existing data.`;

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    dir: { type: 'string' }, 'max-pages': { type: 'string' }, 'list-id': { type: 'string' }, manual: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  const [command] = positionals;
  if (values.help || !command) { console.log(HELP); return; }
  if (positionals.length !== 1 || !['auth', 'config', 'discover', 'export', 'mapping', 'convert', 'report'].includes(command)) throw new Error(HELP);
  if ((values['max-pages'] || values['list-id']) && command !== 'export') throw new Error('Page limits and List selection apply only to export');
  if (values.manual && command !== 'auth') throw new Error('--manual applies only to auth');
  const directory = resolve(values.dir ?? '.local/x-lists');
  const file = (name) => join(directory, name);
  await withLock(directory, async () => {
    const saveTokens = (value) => writeJson(file('tokens.json'), value);
    if (command === 'auth') { await authorize(saveTokens, console.log, { manual: values.manual }); return; }
    const config = validateExportConfig(await readJson(file('config.json'), DEFAULT_EXPORT_CONFIG));
    if (command === 'config') {
      await writeJson(file('config.json'), config);
      console.log(`Edit ${file('config.json')}: put List names in skipListNames to exclude member downloads and import. Existing configuration was preserved.`);
      return;
    }
    if (['mapping', 'convert', 'report'].includes(command)) {
      const archive = applyExportConfig(validateArchive(await readJson(file('archive.json'))), config);
      if (command === 'report') {
        const summary = report(archive);
        await writeJson(file('report.json'), summary);
        console.log(JSON.stringify(summary, null, 2)); return;
      }
      const previous = await readJson(file('mapping.json'), { version: 1, lists: {} });
      if (command === 'mapping') {
        await writeJson(file('mapping.json'), scaffoldMapping(archive, previous));
        console.log(`Edit ${file('mapping.json')} to configure circles, tags, or skip. Existing edits were preserved.`); return;
      }
      const backup = convertArchive(archive, previous);
      await writeJson(file('contexto-import.contexto-backup.json'), backup);
      console.log(`Generated ${backup.data.accounts.length} contacts, ${backup.data.folders.length} circles, ${backup.data.tags.length} tags.`);
      console.log(`Import ${file('contexto-import.contexto-backup.json')} in Contexto Settings using Full restore (replaces the database).`); return;
    }
    let limit;
    if (command === 'export') {
      limit = Number(values['max-pages']);
      if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('export requires --max-pages with a positive integer, e.g. 100 (or 1 for an optional sample)');
      if (values['list-id']) requireId(values['list-id']);
    }
    const request = authenticatedRequester(await readJson(file('tokens.json')), saveTokens);
    // The SDK's default parsing camel-cases response keys. Raw mode preserves X's
    // original fields, including meta.next_token, and unknown profile metadata.
    const me = await request(async (client) => (await client.users.getMe({ requestOptions: { raw: true } })).json(), 'GET /2/users/me');
    if (me.errors?.length || !me.data?.id) throw new Error('Unable to verify authenticated X account');
    requireId(me.data.id);
    const archive = applyExportConfig(validateArchive(await readJson(file('archive.json'), newArchive(me.data))), config);
    if (archive.owner.id !== me.data.id) throw new Error('Export belongs to a different X account; use a different --dir');
    const checkpoint = async () => {
      await writeJson(file('archive.json'), archive);
      await writeJson(file('report.json'), report(archive));
    };
    if (command === 'discover') {
      let pages = 0;
      while (!archive.discovery.complete) {
        if (++pages > 100) throw new Error('Discovery page safety limit reached; run discover again to resume');
        const body = await request(async (client) => (await client.users.getOwnedLists(me.data.id, {
          maxResults: 100, listFields: LIST_FIELDS, paginationToken: archive.discovery.nextToken,
          requestOptions: { raw: true },
        })).json(), 'GET /2/users/{id}/owned_lists');
        let clean;
        try { clean = appendDiscovery(archive, body, new Date().toISOString()); }
        finally { await checkpoint(); }
        if (!clean) throw new Error('X returned discovery errors. Raw response saved; retry after resolving access');
      }
      await checkpoint();
      await writeJson(file('mapping.json'), scaffoldMapping(archive, await readJson(file('mapping.json'), { version: 1, lists: {} })));
      console.log(`Authenticated as @${me.data.username}; found ${Object.keys(archive.lists).length} owned private Lists.`);
      const selection = report(archive);
      console.log(`${selection.selectedLists} selected; ${selection.excludedLists} excluded by name.`);
      if (selection.unmatchedSkipListNames.length) console.log(`Unmatched skip names (fix before export): ${selection.unmatchedSkipListNames.join(', ')}`);
      const estimate = report(archive).estimatedMembershipReadUpperBoundUSD;
      console.log(estimate === null ? 'X omitted member counts; a reliable cost estimate is unavailable.'
        : `Estimated member-read upper bound: $${estimate.toFixed(2)} at $0.01/user, excluding discovery, retries, and changes.`);
      console.log('Review report.json and X spending limits. Export with --max-pages 100, or optionally sample with --max-pages 1. Mapping edits can wait until conversion.'); return;
    }
    if (!archive.discovery.complete) throw new Error('Run discover successfully before exporting members');
    const selection = report(archive);
    if (selection.unmatchedSkipListNames.length) throw new Error(`Skip names do not match discovered private Lists: ${selection.unmatchedSkipListNames.join(', ')}. Fix config.json before exporting members`);
    if (values['list-id'] && !Object.hasOwn(archive.lists, values['list-id'])) throw new Error('List ID is not an owned private List in this archive');
    if (values['list-id'] && isListExcluded(archive, archive.lists[values['list-id']].list)) throw new Error('Requested List is excluded by config.json; no member request was made');
    await checkpoint();
    let pages = 0;
    for (const entry of Object.values(archive.lists)) {
      if (isListExcluded(archive, entry.list)) continue;
      if (values['list-id'] && entry.list.id !== values['list-id']) continue;
      while (!entry.complete && pages < limit) {
        const body = await request(async (client) => (await client.lists.getMembers(entry.list.id, {
          maxResults: 100, userFields: archive.userFields ?? USER_FIELDS, paginationToken: entry.nextToken,
          requestOptions: { raw: true },
        })).json(), 'GET /2/lists/{id}/members');
        pages++;
        let clean;
        try { clean = appendMembers(entry, body, new Date().toISOString()); }
        finally { await checkpoint(); }
        console.log(`Saved member page ${pages}/${limit} for List ${entry.list.id}.`);
        if (!clean) throw new Error('X returned member errors. Raw response retained; resolve access and retry this command');
      }
    }
    await checkpoint();
    const summary = report(archive);
    console.log(`${summary.uniqueUsers} unique users; ${summary.memberships} memberships. Export ${summary.complete ? 'complete' : 'incomplete; run export again to resume'}.`);
    if (summary.lists.some((list) => list.countChanged)) console.log('Some membership counts differ from discovery. See report.json; X may have changed during export.');
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    // Do not dump SDK objects, HTTP bodies, tokens, or stacks to the terminal.
    console.error(error instanceof Error ? error.message : 'Command failed'); process.exitCode = 1;
  });
}

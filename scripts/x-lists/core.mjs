import { createHash } from 'node:crypto';

export const LIST_FIELDS = ['id', 'name', 'private', 'created_at', 'description', 'member_count', 'follower_count'];
// Profile fields only: no Post, media, follower-graph, or affiliation expansions.
export const USER_FIELDS = ['id', 'name', 'username', 'created_at', 'description', 'entities',
  'location', 'profile_banner_url', 'profile_image_url', 'protected', 'public_metrics',
  'verified', 'verified_type', 'is_identity_verified', 'parody', 'url', 'withheld',
  'connection_status', 'receives_your_dm', 'subscription', 'subscription_type',
  'subscribes_to_you', 'subscriber_count', 'verified_followers_count', 'active_follower_count'];

const numericId = (id) => typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const normalizedListName = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();
export const DEFAULT_EXPORT_CONFIG = { version: 1, skipListNames: [] };
export function validateExportConfig(config) {
  if (!object(config) || config.version !== 1 || !Array.isArray(config.skipListNames)
    || config.skipListNames.some((name) => typeof name !== 'string' || !name.trim())) {
    throw new Error('Export config must have version: 1 and skipListNames: an array of nonblank List names');
  }
  return config;
}
export function applyExportConfig(archive, config) {
  archive.exportConfig = structuredClone(validateExportConfig(config));
  return archive;
}
export function isListExcluded(archive, list) {
  const config = validateExportConfig(archive.exportConfig ?? DEFAULT_EXPORT_CONFIG);
  return config.skipListNames.some((name) => normalizedListName(name) === normalizedListName(list.name));
}
export function requireId(id) {
  if (!numericId(id)) throw new Error('Expected a precision-preserving numeric X ID string');
  return id;
}
export function newArchive(owner, now = new Date().toISOString()) {
  requireId(owner.id);
  return { format: 'contexto-x-lists', version: 1, owner, startedAt: now, userFields: USER_FIELDS,
    discovery: { pages: [], complete: false }, lists: {} };
}
export function validateArchive(archive) {
  if (!object(archive) || archive.format !== 'contexto-x-lists' || archive.version !== 1
    || !object(archive.owner) || !object(archive.discovery) || !object(archive.lists)
    || !Array.isArray(archive.discovery.pages) || Number.isNaN(Date.parse(archive.startedAt))) {
    throw new Error('Invalid or unsupported X export archive');
  }
  requireId(archive.owner.id);
  for (const [id, entry] of Object.entries(archive.lists)) {
    requireId(id);
    if (!object(entry) || !object(entry.list) || entry.list.id !== id || entry.list.private !== true
      || typeof entry.list.name !== 'string' || !Array.isArray(entry.pages)) throw new Error('Invalid private List in archive');
  }
  return archive;
}
function checkPage(page) {
  if (!object(page) || (page.data !== undefined && !Array.isArray(page.data))
    || (page.meta?.next_token !== undefined && typeof page.meta.next_token !== 'string')) {
    throw new Error('Unexpected X pagination response; checkpoint was not advanced');
  }
  return page;
}
export function appendDiscovery(archive, body, capturedAt) {
  checkPage(body);
  // Preserve even partial-error responses; do not advance their pagination checkpoint.
  archive.discovery.pages.push({ requestedToken: archive.discovery.nextToken, capturedAt, body });
  if (body.errors?.length) return false;
  for (const list of body.data ?? []) {
    requireId(list.id);
    if (typeof list.private !== 'boolean') throw new Error('X omitted List privacy; discovery cannot be classified');
    if (!list.private) continue;
    if (typeof list.name !== 'string') throw new Error('X omitted a List name');
    if (!Object.hasOwn(archive.lists, list.id)) archive.lists[list.id] = { list, pages: [], complete: false };
  }
  advance(archive.discovery, body);
  return true;
}
function advance(entry, body) {
  const next = body.meta?.next_token;
  if (next && entry.pages.some((page) => page.requestedToken === next)) {
    throw new Error('X repeated a pagination token; stopping to avoid a paid request loop');
  }
  entry.nextToken = next;
  entry.complete = !next;
}
export function appendMembers(entry, body, capturedAt) {
  checkPage(body);
  entry.pages.push({ requestedToken: entry.nextToken, capturedAt, body });
  if (body.errors?.length) return false;
  for (const user of body.data ?? []) requireId(user.id);
  advance(entry, body);
  return true;
}
function successfulPages(entry) {
  return entry.pages.filter((page) => !page.body.errors?.length);
}
function unresolvedErrors(entry) {
  const resolved = new Set(successfulPages(entry).map((page) => page.requestedToken));
  return entry.pages.reduce((count, page) => count + (resolved.has(page.requestedToken) ? 0 : (page.body.errors?.length ?? 0)), 0);
}
export function report(archive) {
  validateArchive(archive);
  const config = validateExportConfig(archive.exportConfig ?? DEFAULT_EXPORT_CONFIG);
  const ids = new Set();
  let memberships = 0;
  const lists = Object.values(archive.lists).map((entry) => {
    const excluded = isListExcluded(archive, entry.list);
    const members = new Set();
    for (const page of successfulPages(entry)) for (const user of page.body.data ?? []) {
      members.add(user.id); if (!excluded) ids.add(user.id);
    }
    if (!excluded) memberships += members.size;
    const errors = unresolvedErrors(entry);
    return { id: entry.list.id, name: entry.list.name, excluded, complete: entry.complete, members: members.size,
      reportedMembers: entry.list.member_count, errors,
      countChanged: !excluded && entry.complete && Number.isInteger(entry.list.member_count) && members.size !== entry.list.member_count };
  });
  const discoveryErrors = unresolvedErrors(archive.discovery);
  const entries = Object.values(archive.lists).filter((entry) => !isListExcluded(archive, entry.list));
  const discoveredNames = new Set(lists.map((list) => normalizedListName(list.name)));
  const unmatchedSkipListNames = config.skipListNames.filter((name) => !discoveredNames.has(normalizedListName(name)));
  return { complete: archive.discovery.complete && !discoveryErrors && !unmatchedSkipListNames.length
      && lists.every((list) => list.excluded || (list.complete && !list.errors)),
    privateLists: lists.length, uniqueUsers: ids.size, memberships, discoveryErrors, lists,
    selectedLists: entries.length, excludedLists: lists.length - entries.length, unmatchedSkipListNames,
    estimatedMembershipReadUpperBoundUSD: entries.every((entry) => Number.isSafeInteger(entry.list.member_count) && entry.list.member_count >= 0)
      ? entries.reduce((n, entry) => n + entry.list.member_count, 0) * 0.01 : null };
}
export function scaffoldMapping(archive, previous = { version: 1, lists: {} }) {
  validateArchive(archive);
  if (previous.version !== 1 || !object(previous.lists)) throw new Error('Unsupported mapping format');
  const mapping = structuredClone(previous);
  for (const { list } of Object.values(archive.lists)) {
    if (isListExcluded(archive, list)) continue;
    if (!Object.hasOwn(mapping.lists, list.id)) mapping.lists[list.id] = {
      listName: list.name, circles: [list.name], tags: [], skip: false,
    };
  }
  return mapping;
}
function names(values) {
  if (!Array.isArray(values) || values.some((name) => typeof name !== 'string' || !name.trim())) {
    throw new Error('Mapping tags/circles must be arrays of nonblank names');
  }
  return values.map((name) => name.trim().replace(/\s+/g, ' '));
}
const stableId = (kind, identity) => `${kind}_${createHash('sha256').update(identity).digest('hex').slice(0, 32)}`;
export function convertArchive(archive, mapping, generatedAt = new Date().toISOString()) {
  validateArchive(archive);
  if (!report(archive).complete) throw new Error('Export is incomplete or has API errors; resolve these before conversion');
  if (mapping?.version !== 1 || !object(mapping.lists)) throw new Error('Unsupported mapping format');
  const data = Object.fromEntries(['accounts', 'companies', 'tags', 'accountTags', 'folders', 'folderAccounts',
    'notes', 'bookmarks', 'searchPresets', 'searchHistory', 'backups', 'changeLog'].map((table) => [table, []]));
  const people = new Map();
  const definitions = { tags: new Map(), folders: new Map() };
  const joins = { tags: new Set(), folders: new Set() };
  const handles = new Map();
  const stamp = { createdAt: generatedAt, updatedAt: generatedAt };
  for (const { list, pages } of Object.values(archive.lists)) {
    if (isListExcluded(archive, list)) continue;
    if (!Object.hasOwn(mapping.lists, list.id)) throw new Error(`Missing mapping for List ${list.id}`);
    const config = mapping.lists[list.id];
    if (!object(config) || typeof config.skip !== 'boolean') throw new Error(`Invalid mapping for List ${list.id}`);
    if (config.skip) continue;
    const labels = { tags: names(config.tags), folders: names(config.circles) };
    for (const [table, values] of Object.entries(labels)) for (const name of values) {
      const normalizedName = name.toLowerCase();
      if (!definitions[table].has(normalizedName)) {
        const value = { id: stableId(table, normalizedName), name, normalizedName, ...stamp };
        definitions[table].set(normalizedName, value); data[table].push(value);
      }
    }
    for (const page of successfulPages({ pages })) for (const user of page.body.data ?? []) {
      requireId(user.id);
      if (typeof user.username !== 'string' || !/^[A-Za-z0-9_]{1,15}$/.test(user.username)) {
        throw new Error(`User ${user.id} lacks a usable handle; raw data retained, conversion stopped`);
      }
      const handle = user.username.toLowerCase();
      if (handles.has(handle) && handles.get(handle) !== user.id) throw new Error(`Conflicting identities for @${handle}`);
      handles.set(handle, user.id);
      let person = people.get(user.id);
      if (!person) {
        person = { id: stableId('account', user.id), platform: 'x', xUserId: user.id,
          ...stamp, syncState: 'local-only', xImport: { version: 1, exportStartedAt: archive.startedAt, profiles: [] } };
        people.set(user.id, person); data.accounts.push(person);
      }
      // Last observation supplies profile fields; all observations remain losslessly available.
      person.handle = user.username; person.normalizedHandle = handle; person.profileUrl = `https://x.com/${handle}`;
      person.displayName = user.name || user.username;
      for (const [field, source, observed] of [['followersCount', 'followers_count', 'followersCountObservedAt'],
        ['followingCount', 'following_count', 'followingCountObservedAt']]) {
        const count = user.public_metrics?.[source];
        if (Number.isSafeInteger(count) && count >= 0 && (!person[observed] || Date.parse(page.capturedAt) >= Date.parse(person[observed]))) {
          person[field] = count; person[observed] = page.capturedAt;
        }
      }
      if (Array.isArray(user.connection_status) && user.connection_status.every(value => typeof value === 'string')
        && typeof archive.owner.username === 'string' && /^[A-Za-z0-9_]{1,15}$/.test(archive.owner.username)
        && (!person.followsYouObservedAt || Date.parse(page.capturedAt) >= Date.parse(person.followsYouObservedAt))) {
        person.followsYou = user.connection_status.includes('followed_by');
        person.followsYouViewerHandle = archive.owner.username.toLowerCase();
        person.followsYouViewerId = archive.owner.id;
        person.followsYouObservedAt = page.capturedAt;
      }
      for (const [field, source] of Object.entries({ avatarUrl: 'profile_image_url', bioSnapshot: 'description',
        location: 'location', website: 'url' })) if (typeof user[source] === 'string') person[field] = user[source];
      const expanded = user.entities?.url?.urls?.find((link) => /^https?:\/\//.test(link.expanded_url ?? ''))?.expanded_url;
      if (expanded) person.website = expanded;
      person.xImport.profiles.push({ listId: list.id, listName: list.name, capturedAt: page.capturedAt, user });
      for (const [table, values] of Object.entries(labels)) for (const name of values) {
        const value = definitions[table].get(name.toLowerCase());
        const key = `${person.id}:${value.id}`;
        if (joins[table].has(key)) continue;
        joins[table].add(key);
        const circle = table === 'folders';
        data[circle ? 'folderAccounts' : 'accountTags'].push({
          id: stableId(circle ? 'folder_account' : 'account_tag', key), accountId: person.id,
          [circle ? 'folderId' : 'tagId']: value.id, createdAt: generatedAt,
        });
      }
    }
  }
  return { app: 'Contexto', formatVersion: 2, exportedAt: generatedAt, data };
}

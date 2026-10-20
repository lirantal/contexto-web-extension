import {
  addNote,
  assignFolder,
  assignTag,
  captureBookmark,
  ensureAccountFromProfile,
  findBookmarkByPost,
  getAccountByHandle,
  getLookups,
  listAccountSummaries,
  markAccountCaughtUp,
  recordSearch,
  saveAccountContext,
  saveAccountGroupings,
  updateAccount,
} from '@/src/data/repositories';
import {
  popupSearchStateItem,
  settingsItem,
  targetHandleHistoryItem,
} from '@/src/shared/settings';
import { buildXSearchUrl, canRunXSearch } from '@/src/shared/platforms/x';
import { promoteTargetHandleHistory } from '@/src/shared/target-handle-suggestions';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { ContextoSettings, PopupSearchState } from '@/src/shared/types';
import type { TargetHandleHistoryEntry } from '@/src/shared/target-handle-suggestions';

type OpenTab = (url: string) => Promise<unknown>;

interface WritableStorageItem<T> {
  getValue(): Promise<T>;
  setValue(value: T): Promise<void>;
}

export interface QuickSearchStorage {
  settingsItem: WritableStorageItem<ContextoSettings>;
  popupSearchStateItem: WritableStorageItem<PopupSearchState>;
  targetHandleHistoryItem: WritableStorageItem<TargetHandleHistoryEntry[]>;
}

interface BackgroundRequestHandlerOptions {
  now?: () => string;
}

function createSerializedQueue() {
  let tail: Promise<void> = Promise.resolve();

  return function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const task = tail.then(work, work);
    tail = task.then(() => undefined, () => undefined);
    return task;
  };
}

const defaultQuickSearchStorage: QuickSearchStorage = {
  settingsItem,
  popupSearchStateItem,
  targetHandleHistoryItem,
};

export function createBackgroundRequestHandler(
  storage: QuickSearchStorage = defaultQuickSearchStorage,
  { now = () => new Date().toISOString() }: BackgroundRequestHandlerOptions = {},
) {
  const enqueueSettings = createSerializedQueue();
  const enqueueSearchState = createSerializedQueue();
  const enqueueTargetHistory = createSerializedQueue();

  return async function handleRequest(
    message: ContextoRequest,
    openTab: OpenTab = (url) => browser.tabs.create({ url }),
  ): Promise<ContextoResponse> {
    try {
      switch (message.type) {
        case 'contexto:account:ensure':
          return { ok: true, account: await ensureAccountFromProfile(message.profile) };
        case 'contexto:account:getByHandle': {
          const account = await getAccountByHandle(message.platform, message.handle);
          return account ? { ok: true, account } : { ok: false, error: 'Account not found' };
        }
        case 'contexto:account:lookup':
          return {
            ok: true,
            lookup: true,
            lookupAccount: await getAccountByHandle(message.platform, message.handle),
          };
        case 'contexto:account:saveContext':
          return { ok: true, account: await saveAccountContext(message.input) };

        case 'contexto:account:update':
          return { ok: true, account: await updateAccount(message.accountId, message.patch) };
        case 'contexto:account:saveGroupings':
          return { ok: true, account: await saveAccountGroupings(message.accountId, message.tagNames, message.folderNames, undefined, message.groupingRevision) };
        case 'contexto:account:markCaughtUp':
          return { ok: true, account: await markAccountCaughtUp(message.accountId) };
        case 'contexto:account:list':
          return { ok: true, accounts: await listAccountSummaries(message.filters) };
        case 'contexto:note:add':
          return { ok: true, account: await addNote(message.accountId, message.body) };
        case 'contexto:bookmark:lookup':
          return {
            ok: true,
            bookmarkLookup: true,
            lookupBookmark: await findBookmarkByPost(message.accountId, message.postUrl),
          };
        case 'contexto:bookmark:capture':
          return {
            ok: true,
            bookmark: await captureBookmark(message.accountId, {
              authorHandle: message.authorHandle,
              postUrl: message.postUrl,
              excerpt: message.excerpt,
              reminder: message.reminder,
            }),
          };
        case 'contexto:tag:assign':
          return { ok: true, account: await assignTag(message.accountId, message.name) };
        case 'contexto:folder:assign':
          return { ok: true, account: await assignFolder(message.accountId, message.name) };
        case 'contexto:lookups:list':
          return { ok: true, lookups: await getLookups() };
        case 'contexto:settings:get':
          return { ok: true, settings: await storage.settingsItem.getValue() };
        case 'contexto:settings:update': {
          const next = await enqueueSettings(async () => {
            const current = await storage.settingsItem.getValue();
            const patched = { ...current, ...message.patch };
            await storage.settingsItem.setValue(patched);
            return patched;
          });
          return { ok: true, settings: next };
        }
        case 'contexto:search-state:update': {
          const next = await enqueueSearchState(async () => {
            const current = await storage.popupSearchStateItem.getValue();
            const patched = { ...current, ...message.patch };
            await storage.popupSearchStateItem.setValue(patched);
            return patched;
          });
          return { ok: true, searchState: next };
        }
        case 'contexto:target-history:promote': {
          const next = await enqueueTargetHistory(async () => {
            const current = await storage.targetHandleHistoryItem.getValue();
            const promoted = promoteTargetHandleHistory(current, message.handle, now());
            await storage.targetHandleHistoryItem.setValue(promoted);
            return promoted;
          });
          return { ok: true, targetHandleHistory: next };
        }
        case 'contexto:search:record':
          return { ok: true, history: await recordSearch(message.filters, message.url, message.accountId) };
        case 'contexto:search:open': {
          if (!canRunXSearch(message.filters)) {
            return { ok: false, error: 'Invalid X search filters' };
          }
          await openTab(buildXSearchUrl(message.filters));
          return { ok: true };
        }
        default:
          return { ok: false, error: 'Unsupported Contexto message' };
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unknown Contexto error' };
    }
  };
}

const defaultHandleRequest = createBackgroundRequestHandler();

export function handleRequest(message: ContextoRequest, openTab?: OpenTab): Promise<ContextoResponse> {
  return defaultHandleRequest(message, openTab);
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => handleRequest({ type: 'contexto:settings:update', patch: {} }));

  browser.runtime.onMessage.addListener((message: ContextoRequest) => {
    if (!message?.type?.startsWith('contexto:')) return undefined;
    return handleRequest(message);
  });
});

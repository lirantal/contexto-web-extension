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
  recordSearch,
  saveAccountContext,
  updateAccount,
} from '@/src/data/repositories';
import { settingsItem } from '@/src/shared/settings';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';

export async function handleRequest(message: ContextoRequest): Promise<ContextoResponse> {
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
        return { ok: true, settings: await settingsItem.getValue() };
      case 'contexto:settings:update': {
        const current = await settingsItem.getValue();
        const next = { ...current, ...message.patch };
        await settingsItem.setValue(next);
        return { ok: true, settings: next };
      }
      case 'contexto:search:record':
        return { ok: true, history: await recordSearch(message.filters, message.url, message.accountId) };
      default:
        return { ok: false, error: 'Unsupported Contexto message' };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown Contexto error' };
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    const settings = await settingsItem.getValue();
    await settingsItem.setValue(settings);
  });

  browser.runtime.onMessage.addListener((message: ContextoRequest) => {
    if (!message?.type?.startsWith('contexto:')) return undefined;
    return handleRequest(message);
  });
});

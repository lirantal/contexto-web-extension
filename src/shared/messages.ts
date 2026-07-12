import type {
  AccountContextSaveInput,
  AccountFilters,
  AccountSummary,
  AccountUpdateInput,
  Bookmark,
  ContextoSettings,
  LookupData,
  ProfileSnapshot,
  RecordId,
  SearchHistory,
  XSearchFilters,
} from './types';

export type ContextoRequest =
  | { type: 'contexto:account:ensure'; profile: ProfileSnapshot }
  | { type: 'contexto:account:getByHandle'; platform: 'x'; handle: string }
  | { type: 'contexto:account:lookup'; platform: 'x'; handle: string }
  | { type: 'contexto:account:saveContext'; input: AccountContextSaveInput }
  | { type: 'contexto:account:update'; accountId: RecordId; patch: AccountUpdateInput }
  | { type: 'contexto:account:list'; filters?: AccountFilters }
  | { type: 'contexto:note:add'; accountId: RecordId; body: string }
  | { type: 'contexto:bookmark:lookup'; accountId: RecordId; postUrl: string }
  | {
    type: 'contexto:bookmark:capture';
    accountId: RecordId;
    authorHandle: string;
    postUrl: string;
    excerpt?: string;
    reminder?: string;
  }
  | { type: 'contexto:tag:assign'; accountId: RecordId; name: string }
  | { type: 'contexto:folder:assign'; accountId: RecordId; name: string }
  | { type: 'contexto:lookups:list' }
  | { type: 'contexto:settings:get' }
  | { type: 'contexto:settings:update'; patch: Partial<ContextoSettings> }
  | { type: 'contexto:search:record'; accountId?: RecordId; filters: XSearchFilters; query: string; url: string };

export type ContextoResponse =
  | { ok: true; account: AccountSummary }
  | { ok: true; lookup: true; lookupAccount: AccountSummary | undefined }
  | { ok: true; bookmarkLookup: true; lookupBookmark: Bookmark | undefined }
  | { ok: true; bookmark: Bookmark }
  | { ok: true; accounts: AccountSummary[] }
  | { ok: true; lookups: LookupData }
  | { ok: true; settings: ContextoSettings }
  | { ok: true; history: SearchHistory }
  | { ok: true }
  | { ok: false; error: string };

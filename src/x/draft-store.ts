import { normalizeXHandle } from '@/src/shared/platforms/x';
import type { AccountContextSaveInput } from '@/src/shared/types';

export type AccountContextDraft = Omit<AccountContextSaveInput, 'profile'>;

export class AccountDraftStore {
  private readonly drafts = new Map<string, AccountContextDraft>();

  get(handle: string): AccountContextDraft | undefined {
    return this.drafts.get(normalizeXHandle(handle));
  }

  set(handle: string, draft: AccountContextDraft): void { this.drafts.set(normalizeXHandle(handle), draft); }
  clear(handle: string): void { this.drafts.delete(normalizeXHandle(handle)); }
  clearAll(): void { this.drafts.clear(); }
}

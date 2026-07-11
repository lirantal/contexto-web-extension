import { describe, expect, it } from 'vitest';
import { AccountDraftStore } from '@/src/x/draft-store';

describe('AccountDraftStore', () => {
  it('keys drafts by normalized X handle and clears them', () => {
    const store = new AccountDraftStore();
    const draft = { metadata: { position: 'CEO' }, tagNames: ['Founder'], folderNames: ['Friends'] };
    store.set('@Theo', draft);
    expect(store.get('theo')).toEqual(draft);
    store.clear('@theo');
    expect(store.get('THEO')).toBeUndefined();
  });
});

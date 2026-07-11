import { useEffect, useState } from 'react';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { AccountSummary, LookupData, ProfileSnapshot } from '@/src/shared/types';
import type { XSurfaceKind } from '@/src/x/extract-profile';
import { AccountDraftStore, type AccountContextDraft } from '@/src/x/draft-store';
import { MultiValueField } from './MultiValueField';

export interface ContextoProfileSurfaceProps {
  profile: ProfileSnapshot;
  kind: XSurfaceKind;
  send(message: ContextoRequest): Promise<ContextoResponse>;
  drafts: AccountDraftStore;
}

const emptyLookups: LookupData = { companies: [], tags: [], folders: [] };

function draftFor(profile: ProfileSnapshot, account?: AccountSummary): AccountContextDraft {
  return {
    metadata: {
      displayName: account?.displayName ?? profile.displayName ?? profile.handle,
      position: account?.position ?? '', profession: account?.profession ?? '',
      companyName: account?.company?.name ?? '', location: account?.location ?? profile.location ?? '',
      relationshipSource: account?.relationshipSource ?? '',
    },
    tagNames: account?.tags.map((tag) => tag.name) ?? [],
    folderNames: account?.folders.map((folder) => folder.name) ?? [],
  };
}

export function ContextoProfileSurface({ profile, kind, send, drafts }: ContextoProfileSurfaceProps) {
  const [state, setState] = useState<'loading' | 'editing' | 'summary' | 'lookup-error'>('loading');
  const [account, setAccount] = useState<AccountSummary>();
  const [draft, setDraft] = useState<AccountContextDraft>(() => drafts.get(profile.handle) ?? draftFor(profile));
  const [lookups, setLookups] = useState<LookupData>(emptyLookups);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    Promise.all([
      send({ type: 'contexto:account:lookup', platform: 'x', handle: profile.handle }),
      send({ type: 'contexto:lookups:list' }),
    ]).then(([lookupResponse, lookupDataResponse]) => {
      if (cancelled) return;
      if (!lookupResponse.ok || !('lookup' in lookupResponse)) {
        setError(!lookupResponse.ok ? lookupResponse.error : 'Could not look up this account');
        setState('lookup-error');
        return;
      }
      if (lookupDataResponse.ok && 'lookups' in lookupDataResponse) setLookups(lookupDataResponse.lookups);
      const found = lookupResponse.lookupAccount;
      setAccount(found);
      if (found) { setDraft(draftFor(profile, found)); setState('summary'); }
      else { setDraft(drafts.get(profile.handle) ?? draftFor(profile)); setState('editing'); }
    }).catch((caught) => {
      if (!cancelled) { setError(caught instanceof Error ? caught.message : 'Could not load Contexto'); setState('lookup-error'); }
    });
    return () => { cancelled = true; };
  }, [profile.handle, profile.profileUrl, send, drafts]);

  function updateDraft(next: AccountContextDraft) { setDraft(next); drafts.set(profile.handle, next); }
  function updateMetadata(field: keyof AccountContextDraft['metadata'], value: string) {
    updateDraft({ ...draft, metadata: { ...draft.metadata, [field]: value } });
  }
  async function saveContext() {
    setSaving(true); setError('');
    const response = await send({ type: 'contexto:account:saveContext', input: { profile, ...draft } });
    setSaving(false);
    if (response.ok && 'account' in response && response.account) {
      drafts.clear(profile.handle); setAccount(response.account); setDraft(draftFor(profile, response.account)); setState('summary'); return;
    }
    setError(!response.ok ? response.error : 'Contexto did not return the saved account');
  }
  function cancelEditing() {
    setDraft(draftFor(profile, account)); drafts.clear(profile.handle); if (account) setState('summary');
  }

  if (state === 'loading') return <section className="contexto-surface"><p role="status">Loading Contexto…</p></section>;
  if (state === 'lookup-error') return <section className="contexto-surface"><p className="contexto-error">{error}</p></section>;
  if (state === 'summary' && account) {
    const role = [account.position, account.company?.name].filter(Boolean).join(' at ');
    return <section className="contexto-surface" data-surface={kind} aria-label="Contexto profile context">
      <header className="contexto-header"><strong>◆ Contexto</strong><button type="button" onClick={() => setState('editing')}>Edit</button></header>
      <div className="contexto-summary"><h3>{account.displayName}</h3>{role && <p>{role}</p>}
        <div className="chip-row">{account.tags.map((tag) => <span className="chip" key={tag.id}>{tag.name}</span>)}</div>
      </div>
    </section>;
  }

  return <section className="contexto-surface" data-surface={kind} aria-label="Contexto profile editor">
    <header className="contexto-header"><strong>◆ Contexto</strong>{!account && <span className="status-pill">Not saved</span>}</header>
    <div className="contexto-form">
      <label>Display name<input value={draft.metadata.displayName ?? ''} disabled={saving} onChange={(event) => updateMetadata('displayName', event.target.value)} /></label>
      <label>X handle<input value={`@${profile.handle}`} readOnly /></label>
      <div className="field-row">
        <label>Position<input value={draft.metadata.position ?? ''} disabled={saving} onChange={(event) => updateMetadata('position', event.target.value)} /></label>
        <label>Profession<input value={draft.metadata.profession ?? ''} disabled={saving} onChange={(event) => updateMetadata('profession', event.target.value)} /></label>
      </div>
      <label>Company<input list="contexto-companies" value={draft.metadata.companyName ?? ''} disabled={saving} onChange={(event) => updateMetadata('companyName', event.target.value)} /></label>
      <datalist id="contexto-companies">{lookups.companies.map((company) => <option key={company.id} value={company.name} />)}</datalist>
      <label>Location<input value={draft.metadata.location ?? ''} disabled={saving} onChange={(event) => updateMetadata('location', event.target.value)} /></label>
      <label>How you know them<input value={draft.metadata.relationshipSource ?? ''} disabled={saving} onChange={(event) => updateMetadata('relationshipSource', event.target.value)} /></label>
      <MultiValueField label="Tags" values={draft.tagNames} suggestions={lookups.tags.map((tag) => tag.name)} disabled={saving} onChange={(tagNames) => updateDraft({ ...draft, tagNames })} />
      <MultiValueField label="Folders" values={draft.folderNames} suggestions={lookups.folders.map((folder) => folder.name)} disabled={saving} onChange={(folderNames) => updateDraft({ ...draft, folderNames })} />
      {error && <p className="contexto-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="primary-action" type="button" disabled={saving} onClick={saveContext}>{saving ? 'Saving…' : account ? 'Save changes' : 'Save to Contexto'}</button>
        {error && <button type="button" disabled={saving} onClick={saveContext}>Retry save</button>}
        <button type="button" disabled={saving} onClick={cancelEditing}>Cancel</button>
      </div>
    </div>
  </section>;
}

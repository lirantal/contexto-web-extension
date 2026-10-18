import React, { useEffect, useState } from 'react';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { AccountSummary, LookupData, ProfileSnapshot } from '@/src/shared/types';
import type { XSurfaceKind } from '@/src/x/extract-profile';
import { AccountDraftStore, type AccountContextDraft } from '@/src/x/draft-store';
import { FuzzyTextCombobox } from './FuzzyTextCombobox';
import { MultiValueField } from './MultiValueField';

export interface ContextoProfileSurfaceProps {
  profile: ProfileSnapshot;
  kind: XSurfaceKind;
  send(message: ContextoRequest): Promise<ContextoResponse>;
  drafts: AccountDraftStore;
  onRequestClose?: () => void;
  placement?: 'inline' | 'docked' | 'modal';
}

const emptyLookups: LookupData = { companies: [], tags: [], folders: [], locations: [] };

function draftFor(profile: ProfileSnapshot, account?: AccountSummary): AccountContextDraft {
  return {
    metadata: {
      displayName: account?.displayName ?? profile.displayName ?? profile.handle,
      role: account?.role ?? '',
      companyName: account?.company?.name ?? '', location: account?.location ?? profile.location ?? '',
      relationshipSource: account?.relationshipSource ?? '',
    },
    tagNames: account?.tags.map((tag) => tag.name) ?? [],
    folderNames: account?.folders.map((folder) => folder.name) ?? [],
  };
}

export function ContextoProfileSurface({ profile, kind, send, drafts, onRequestClose, placement = 'inline' }: ContextoProfileSurfaceProps) {
  const [state, setState] = useState<'loading' | 'editing' | 'lookup-error'>('loading');
  const [account, setAccount] = useState<AccountSummary>();
  const [draft, setDraft] = useState<AccountContextDraft>(() => drafts.get(profile.handle) ?? draftFor(profile));
  const [lookups, setLookups] = useState<LookupData>(emptyLookups);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookupAttempt, setLookupAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError('');
    setSuccess('');
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
      const storedDraft = drafts.get(profile.handle);
      setDraft(storedDraft ?? draftFor(profile, found));
      setState('editing');
    }).catch((caught) => {
      if (!cancelled) { setError(caught instanceof Error ? caught.message : 'Could not load Contexto'); setState('lookup-error'); }
    });
    return () => { cancelled = true; };
  }, [profile.handle, profile.profileUrl, send, drafts, lookupAttempt]);

  function updateDraft(next: AccountContextDraft) { setDraft(next); drafts.set(profile.handle, next); }
  function updateMetadata(field: keyof AccountContextDraft['metadata'], value: string) {
    updateDraft({ ...draft, metadata: { ...draft.metadata, [field]: value } });
  }
  async function saveContext() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await send({ type: 'contexto:account:saveContext', input: { profile, ...draft } });
      if (response.ok && 'account' in response && response.account) {
        drafts.clear(profile.handle); setAccount(response.account); setDraft(draftFor(profile, response.account)); setSuccess('Saved to Contexto'); onRequestClose?.(); return;
      }
      setError(!response.ok ? response.error : 'Contexto did not return the saved account');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save Contexto metadata');
    } finally {
      setSaving(false);
    }
  }
  function cancelEditing() {
    setDraft(draftFor(profile, account));
    drafts.clear(profile.handle);
    setError('');
    setSuccess('');
    onRequestClose?.();
  }

  if (state === 'loading') return <section className="contexto-surface"><p role="status">Loading Contexto…</p></section>;
  if (state === 'lookup-error') return <section className="contexto-surface">
    <p className="contexto-error" role="alert">{error}</p>
    <button type="button" onClick={() => setLookupAttempt((attempt) => attempt + 1)}>Retry lookup</button>
  </section>;
  return <section className="contexto-surface" data-surface={kind} data-placement={placement} role={placement === 'modal' ? 'dialog' : 'region'} aria-modal={placement === 'modal' ? true : undefined} aria-label="Contexto profile editor">
    <header className="contexto-header"><strong>◆ Contexto</strong><span className="status-pill">{!account ? 'Not saved' : 'Saved'}</span></header>
    <div className="contexto-form">
      <label>Display name<input value={draft.metadata.displayName ?? ''} disabled={saving} onChange={(event) => updateMetadata('displayName', event.target.value)} /></label>
      <label>X handle<input value={`@${profile.handle}`} readOnly /></label>
      <label>Role<input value={draft.metadata.role ?? ''} disabled={saving} onChange={(event) => updateMetadata('role', event.target.value)} /></label>
      <label>Company<input list="contexto-companies" value={draft.metadata.companyName ?? ''} disabled={saving} onChange={(event) => updateMetadata('companyName', event.target.value)} /></label>
      <datalist id="contexto-companies">{lookups.companies.map((company) => <option key={company.id} value={company.name} />)}</datalist>
      <FuzzyTextCombobox label="Location" value={draft.metadata.location ?? ''} suggestions={lookups.locations}
        disabled={saving} onChange={(location) => updateMetadata('location', location)} />
      <label>How you know them<input value={draft.metadata.relationshipSource ?? ''} disabled={saving} onChange={(event) => updateMetadata('relationshipSource', event.target.value)} /></label>
      <MultiValueField label="Tags" values={draft.tagNames} suggestions={lookups.tags.map((tag) => tag.name)} disabled={saving} onChange={(tagNames) => updateDraft({ ...draft, tagNames })} />
      <MultiValueField label="Folders" values={draft.folderNames} suggestions={lookups.folders.map((folder) => folder.name)} disabled={saving} onChange={(folderNames) => updateDraft({ ...draft, folderNames })} />
      {success && <p className="contexto-success" role="status" aria-live="polite">{success}</p>}
      {error && <p className="contexto-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="primary-action" type="button" disabled={saving} onClick={saveContext}>{saving ? 'Saving…' : account ? 'Save changes' : 'Save to Contexto'}</button>
        {error && <button type="button" disabled={saving} onClick={saveContext}>Retry save</button>}
        <button type="button" disabled={saving} onClick={cancelEditing}>Cancel</button>
      </div>
    </div>
  </section>;
}

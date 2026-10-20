import React, { useEffect, useRef, useState } from 'react';
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

const emptyLookups: LookupData = { companies: [], tags: [], folders: [], locations: [], roles: [] };

function draftFor(profile: ProfileSnapshot, account?: AccountSummary, savedOnly = false): AccountContextDraft {
  return {
    groupingRevision: account?.groupingRevision,
    metadata: {
      displayName: account?.displayName ?? profile.displayName ?? profile.handle,
      role: account?.role ?? '',
      website: account?.website ?? (savedOnly ? '' : profile.website) ?? '',
      companyName: account?.company?.name ?? '', location: account?.location ?? (savedOnly ? '' : profile.location) ?? '',
      relationshipSource: account?.relationshipSource ?? '',
    },
    tagNames: account?.tags.map((tag) => tag.name) ?? [],
    folderNames: account?.folders.map((folder) => folder.name) ?? [],
  };
}

function prefilledDraftFor(profile: ProfileSnapshot, account?: AccountSummary): AccountContextDraft {
  const draft = draftFor(profile, account);
  if (!draft.metadata.location?.trim()) draft.metadata.location = profile.location ?? '';
  if (!draft.metadata.website?.trim()) draft.metadata.website = profile.website ?? '';
  return draft;
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
  const reloadSavedOnly = useRef(false);

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
      setDraft(storedDraft ?? { ...(reloadSavedOnly.current ? draftFor(profile, found, true) : prefilledDraftFor(profile, found)), groupingRevision: found?.groupingRevision ?? (lookupDataResponse.ok && 'lookups' in lookupDataResponse ? lookupDataResponse.lookups.groupingRevision : undefined) });
      reloadSavedOnly.current = false;
      setState('editing');
    }).catch((caught) => {
      if (!cancelled) { setError(caught instanceof Error ? caught.message : 'Could not load Contexto'); setState('lookup-error'); }
    });
    return () => { cancelled = true; };
  }, [profile.handle, profile.profileUrl, send, drafts, lookupAttempt]);

  function updateDraft(change: AccountContextDraft | ((current: AccountContextDraft) => AccountContextDraft)) {
    setDraft((current) => {
      const next = typeof change === 'function' ? change(current) : change;
      drafts.set(profile.handle, next);
      return next;
    });
  }
  function updateMetadata(field: keyof AccountContextDraft['metadata'], value: string) {
    updateDraft({ ...draft, metadata: { ...draft.metadata, [field]: value } });
  }
  async function saveContext() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const { tagQuery = '', folderQuery = '', ...context } = draft;
      function includePending(values: string[], query: string) {
        const value = query.trim();
        return value && !values.some((existing) => existing.toLowerCase() === value.toLowerCase())
          ? [...values, value] : values;
      }
      const response = await send({ type: 'contexto:account:saveContext', input: { profile, ...context, tagNames: includePending(draft.tagNames, tagQuery), folderNames: includePending(draft.folderNames, folderQuery) } });
      if (response.ok && 'account' in response && response.account) {
        drafts.clear(profile.handle); setAccount(response.account); setDraft(draftFor(profile, response.account, true)); setSuccess('Saved to Contexto'); onRequestClose?.(); return;
      }
      setError(!response.ok ? response.error : 'Contexto did not return the saved account');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save Contexto metadata');
    } finally {
      setSaving(false);
    }
  }
  function cancelEditing() {
    setDraft({ ...draftFor(profile, account, true), groupingRevision: account?.groupingRevision ?? lookups.groupingRevision });
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
      <section className="contexto-form-section" role="group" aria-labelledby="contexto-identity-heading">
        <h2 id="contexto-identity-heading">Identity</h2>
        <div className="contexto-field-row">
          <label>Display name<input value={draft.metadata.displayName ?? ''} disabled={saving} onChange={(event) => updateMetadata('displayName', event.target.value)} /></label>
          <label>X handle<input value={`@${profile.handle}`} readOnly /></label>
        </div>
        <div className="contexto-field-row">
          <FuzzyTextCombobox label="Location" value={draft.metadata.location ?? ''} suggestions={lookups.locations}
            disabled={saving} onChange={(location) => updateMetadata('location', location)} />
          <label>Website<input value={draft.metadata.website ?? ''} disabled={saving} onChange={(event) => updateMetadata('website', event.target.value)} /></label>
        </div>
      </section>
      <section className="contexto-form-section" role="group" aria-labelledby="contexto-work-heading">
        <h2 id="contexto-work-heading">Work</h2>
        <div className="contexto-field-row">
          <FuzzyTextCombobox label="Role" value={draft.metadata.role ?? ''} suggestions={lookups.roles}
            disabled={saving} onChange={(role) => updateMetadata('role', role)} />
          <FuzzyTextCombobox label="Company" value={draft.metadata.companyName ?? ''}
            suggestions={lookups.companies.map((company) => company.name)} disabled={saving}
            onChange={(companyName) => updateMetadata('companyName', companyName)} />
        </div>
      </section>
      <section className="contexto-form-section" role="group" aria-labelledby="contexto-relationship-heading">
        <h2 id="contexto-relationship-heading">Relationship</h2>
        <div className="contexto-field-row">
          <label>How you know them<input value={draft.metadata.relationshipSource ?? ''} disabled={saving} onChange={(event) => updateMetadata('relationshipSource', event.target.value)} /></label>
        </div>
        <MultiValueField label="Tags" query={draft.tagQuery ?? ''} onQueryChange={(tagQuery) => updateDraft((current) => ({ ...current, tagQuery }))} values={draft.tagNames} suggestions={lookups.tags.map((tag) => tag.name)} disabled={saving} onChange={(tagNames) => updateDraft({ ...draft, tagNames })} />
        <MultiValueField label="Circles" query={draft.folderQuery ?? ''} onQueryChange={(folderQuery) => updateDraft((current) => ({ ...current, folderQuery }))} values={draft.folderNames} suggestions={lookups.folders.map((folder) => folder.name)} disabled={saving} onChange={(folderNames) => updateDraft({ ...draft, folderNames })} />
      </section>
      {success && <p className="contexto-success" role="status" aria-live="polite">{success}</p>}
      {error && <p className="contexto-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="primary-action" type="button" disabled={saving} onClick={saveContext}>{saving ? 'Saving…' : account ? 'Save changes' : 'Save to Contexto'}</button>
        {error && <><button type="button" disabled={saving} onClick={saveContext}>Retry save</button><button type="button" disabled={saving} onClick={() => { drafts.clear(profile.handle); reloadSavedOnly.current = true; setLookupAttempt((attempt) => attempt + 1); }}>Reload saved values</button></>}
        <button type="button" disabled={saving} onClick={cancelEditing}>Cancel</button>
      </div>
    </div>
  </section>;
}

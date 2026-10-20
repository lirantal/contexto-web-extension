import React, { useEffect, useRef, useState } from 'react';
import type { AccountSummary } from '@/src/shared/types';
import type { ContextoProfileSurfaceProps } from './ContextoProfileSurface';
import { MultiValueField } from './MultiValueField';

interface FeedGroupingsEditorProps {
  account: AccountSummary;
  send: ContextoProfileSurfaceProps['send'];
  onSaved(account: AccountSummary): void;
  onCancel(): void;
}

export function FeedGroupingsEditor({ account, send, onSaved, onCancel }: FeedGroupingsEditorProps) {
  const [baseline, setBaseline] = useState(account);
  const [tags, setTags] = useState(() => account.tags.map((tag) => tag.name).filter((name) => name.trim()));
  const [folders, setFolders] = useState(() => account.folders.map((folder) => folder.name).filter((name) => name.trim()));
  const [tagQuery, setTagQuery] = useState('');
  const [folderQuery, setFolderQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ tags: [] as string[], folders: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    rootRef.current?.querySelector('input')?.focus();
    return () => { activeRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    send({ type: 'contexto:lookups:list' }).then((response) => {
      if (!cancelled && response.ok && 'lookups' in response) {
        setSuggestions({ tags: response.lookups.tags.map((tag) => tag.name), folders: response.lookups.folders.map((folder) => folder.name) });
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [send]);

  function includePending(values: string[], query: string) {
    const pending = query.trim();
    return pending && !values.some((value) => value.trim().toLowerCase() === pending.toLowerCase())
      ? [...values, pending] : values;
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const response = await send({
        type: 'contexto:account:saveGroupings', accountId: account.id,
        ...(baseline.groupingRevision !== undefined ? { groupingRevision: baseline.groupingRevision } : {}),
        tagNames: includePending(tags, tagQuery), folderNames: includePending(folders, folderQuery),
      });
      if (!activeRef.current) return;
      if (response.ok && 'account' in response) {
        onSaved(response.account);
      } else {
        setError(!response.ok ? response.error : 'Could not save tags and folders');
      }
    } catch (caught) {
      if (activeRef.current) setError(caught instanceof Error ? caught.message : 'Could not save tags and folders');
    } finally {
      if (activeRef.current) setSaving(false);
    }
  }

  async function reloadSavedValues() {
    setSaving(true); setError('');
    try {
      const response = await send({ type: 'contexto:account:lookup', platform: 'x', handle: account.handle });
      if (!activeRef.current) return;
      if (!response.ok || !('lookup' in response) || !response.lookupAccount) {
        throw new Error(!response.ok ? response.error : 'Contact no longer exists.');
      }
      const current = response.lookupAccount;
      setBaseline(current);
      setTags(current.tags.map((tag) => tag.name));
      setFolders(current.folders.map((folder) => folder.name));
      setTagQuery(''); setFolderQuery('');
      const lookup = await send({ type: 'contexto:lookups:list' });
      if (activeRef.current && lookup.ok && 'lookups' in lookup) {
        setSuggestions({ tags: lookup.lookups.tags.map((tag) => tag.name), folders: lookup.lookups.folders.map((folder) => folder.name) });
      }
    } catch (caught) {
      if (activeRef.current) setError(caught instanceof Error ? caught.message : 'Could not reload saved values.');
    } finally { if (activeRef.current) setSaving(false); }
  }

  return <div ref={rootRef} className="contexto-feed-groupings-editor" role="group" aria-label="Edit tags and folders">
    <MultiValueField label="Tags" values={tags} suggestions={suggestions.tags} onChange={setTags}
      query={tagQuery} onQueryChange={setTagQuery} disabled={saving} />
    <MultiValueField label="Folders" values={folders} suggestions={suggestions.folders} onChange={setFolders}
      query={folderQuery} onQueryChange={setFolderQuery} disabled={saving} />
    {error && <p className="contexto-error" role="alert">{error}</p>}
    <div className="form-actions">
      <button type="button" className="primary-action" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : 'Save tags and folders'}
      </button>
      {error && <button type="button" disabled={saving} onClick={reloadSavedValues}>Reload saved values</button>}
      <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
    </div>
  </div>;
}

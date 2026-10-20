import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listManagedGroupings, manageGrouping, type GroupingKind, type ManagedGrouping } from '../data/grouping-management';

export function ManageData({ onBack }: { onBack(): void }) {
  const [kind, setKind] = useState<GroupingKind>('tag');
  return <main className="manage-data">
    <header className="management-heading">
      <div><h1>Manage data</h1><p>Manage shared values in this browser’s Contexto database.</p></div>
      <button type="button" onClick={onBack}>Back to accounts</button>
    </header>
    <nav className="management-actions" aria-label="Data types">
      <button type="button" aria-pressed={kind === 'tag'} onClick={() => setKind('tag')}>Tags</button>
      <button type="button" aria-pressed={kind === 'folder'} onClick={() => setKind('folder')}>Folders</button>
    </nav>
    <GroupingManager key={kind} kind={kind} />
    <p className="filter-help">Importing an older backup can restore removed values. Export a backup from dashboard Settings before making changes you may want to reverse.</p>
  </main>;
}

function GroupingManager({ kind }: { kind: GroupingKind }) {
  const [query, setQuery] = useState('');
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [sort, setSort] = useState('name');
  const [selection, setSelection] = useState<{ item: ManagedGrouping; action: 'view' | 'rename' | 'merge' | 'delete'; revision: string }>();
  const [name, setName] = useState('');
  const [targetId, setTargetId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const result = useLiveQuery(async () => {
    try { return { data: await listManagedGroupings(kind), error: '' }; }
    catch (caught) { return { data: undefined, error: caught instanceof Error ? caught.message : 'Could not load values.' }; }
  }, [kind]);
  const items = result?.data?.items ?? [];
  const visible = items.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && (!unusedOnly || item.contacts.length === 0))
    .sort((a, b) => sort === 'usage' ? b.contacts.length - a.contacts.length || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  const selected = selection && items.find((item) => item.id === selection.item.id);
  const preview = selected ?? selection?.item;
  const target = items.find((item) => item.id === targetId);
  const collision = items.find((item) => item.id !== selected?.id
    && item.name.trim().replace(/\s+/g, ' ').toLowerCase() === name.trim().replace(/\s+/g, ' ').toLowerCase());

  function open(item: ManagedGrouping, action: NonNullable<typeof selection>['action']) {
    setSelection({ item, action, revision: result!.data!.revision });
    setName(item.name); setTargetId(''); setError(''); setStatus('');
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selection || selection.action === 'view') return;
    setPending(true); setError('');
    try {
      await manageGrouping(kind, selection.item.id,
        selection.action === 'rename' ? { type: 'rename', name }
          : selection.action === 'merge' ? { type: 'merge', targetId } : { type: 'delete' }, selection.revision);
      setStatus(selection.action === 'rename' ? 'Value renamed everywhere.'
        : selection.action === 'merge' ? 'Values merged. The source value was removed.' : 'Value and all its assignments deleted.');
      setSelection(undefined);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update this value.'); }
    finally { setPending(false); }
  }

  return <section aria-label={`Manage ${kind === 'tag' ? 'tags' : 'folders'}`} className="management-content">
    <div className="management-toolbar panel detail-section">
      <label>Search {kind === 'tag' ? 'tags' : 'folders'}<input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="name">Name</option><option value="usage">Most contacts</option>
      </select></label>
      <label className="checkbox-field"><input type="checkbox" checked={unusedOnly} onChange={(e) => setUnusedOnly(e.target.checked)} />Unused only</label>
    </div>
    {!result && <p role="status">Loading values…</p>}
    {result?.error && <p role="alert" className="error-line">{result.error}</p>}
    {status && <p role="status" className="status-line">{status}</p>}
    <div className="management-table-scroll panel">
      <table className="management-table">
        <caption>{kind === 'tag' ? 'Tags' : 'Folders'} and contact usage</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Contacts</th><th scope="col">Actions</th></tr></thead>
        <tbody>{visible.map((item) => <tr key={item.id}>
          <th scope="row">{item.name}</th><td>{item.contacts.length}</td>
          <td><div className="management-actions">{(['view', 'rename', 'merge', 'delete'] as const).map((action) =>
            <button type="button" key={action} disabled={pending} aria-label={`${action === 'view' ? 'View contacts for' : action[0].toUpperCase() + action.slice(1)} ${item.name}`}
              onClick={() => open(item, action)}>{action === 'view' ? 'View contacts' : action[0].toUpperCase() + action.slice(1)}</button>)}</div></td>
        </tr>)}</tbody>
      </table>
      {result?.data && visible.length === 0 && <p className="empty-state">No values match. Try another search or turn off Unused only.</p>}
    </div>
    {selection && preview && <section className="panel detail-section" aria-label={`${selection.action} ${kind}`}>
      <h2>{selection.action === 'view' ? 'Contacts using' : selection.action === 'delete' ? 'Delete everywhere:' : selection.action === 'merge' ? 'Merge:' : 'Rename:'} {preview.name}</h2>
      <p>{preview.contacts.length} contact{preview.contacts.length === 1 ? '' : 's'} {selection.action === 'view' ? 'using this value' : 'affected'}.</p>
      <ul className="management-contact-list">{preview.contacts.map((contact) => <li key={contact.id}>{contact.displayName} <span>@{contact.handle}</span></li>)}</ul>
      {preview.contacts.length === 0 && <p>No contacts use this value.</p>}
      {selection.action === 'view' ? <button type="button" onClick={() => setSelection(undefined)}>Close preview</button> : <form onSubmit={submit}>
        <fieldset disabled={pending}>
          {selection.action === 'rename' && <>
            <label>New name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
            {collision && <p>That name already exists. <button type="button" onClick={() => {
              setSelection({ ...selection, action: 'merge' }); setTargetId(collision.id); setError('');
            }}>Merge into {collision.name}</button></p>}
          </>}
          {selection.action === 'merge' && <>
            <label>Merge into<select value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
              <option value="">Choose destination</option>
              {items.filter((item) => item.id !== preview.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            {target && <p>Keep “{target.name}” for {new Set([...preview.contacts, ...target.contacts].map((c) => c.id)).size} contacts. Duplicate assignments will be combined.</p>}
            <p>All source assignments move to the destination, then “{preview.name}” is permanently deleted.</p>
          </>}
          {selection.action === 'delete' && <p className="danger-warning">Permanently delete {kind} “{preview.name}” from Contexto’s database and remove it from all {preview.contacts.length} contacts? Contacts and their other saved data remain intact.</p>}
          {error && <p role="alert" className="error-line">{error}</p>}
          <div className="management-actions">
            <button type="button" onClick={() => setSelection(undefined)}>Cancel</button>
            <button type="submit" className={selection.action === 'delete' ? 'danger-action' : 'primary-action'}
              disabled={pending || !selected || (selection.action === 'rename' && (!name.trim() || !!collision)) || (selection.action === 'merge' && !target)}>
              {pending ? 'Saving…' : selection.action === 'delete' ? `Delete ${kind} everywhere` : selection.action === 'merge' ? 'Merge values' : 'Rename everywhere'}
            </button>
          </div>
        </fieldset>
      </form>}
    </section>}
  </section>;
}

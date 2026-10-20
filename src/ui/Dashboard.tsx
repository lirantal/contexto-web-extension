import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArchiveRestore,
  Building2,
  ExternalLink,
  UsersRound,
  RefreshCw,
  Search,
  Settings,
  Tag,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  addNote,
  assignFolder,
  assignTag,
  deleteAccount,
  ensureAccountFromProfile,
  getLookups,
  getAccountSummary,
  listAccountSummaries,
  markAccountCaughtUp,
  recordSearch,
  removeFolder,
  removeTag,
  updateAccount,
} from '@/src/data/repositories';
import { buildXCatchUpSearchUrl, buildXSearchQuery, buildXSearchUrl, labelSearchDirection, normalizeXHandle } from '@/src/shared/platforms/x';
import {
  clearTargetHandleHistory,
  defaultSettings,
  normalizeContextoSettings,
  settingsItem,
} from '@/src/shared/settings';
import type { ContextoSettingsPersistence } from '@/src/shared/quick-x-search-persistence';
import type { AccountFilters, AccountSummary, ContextoSettings, SearchDirection, XSearchFilters } from '@/src/shared/types';
import { getAdjacentAccountId } from './account-navigation';
import { ManageData } from './ManageData';
import { BackupControls } from './BackupControls';
import { AccountBookmarks } from './AccountBookmarks';
import { AccountFilterField } from './AccountFilterField';
import { FuzzyTextCombobox } from './FuzzyTextCombobox';

const searchDirections: SearchDirection[] = ['me-to-them', 'them-to-me', 'from-profile', 'to-profile', 'mentions'];

export function Dashboard({
  settingsPersistence,
}: {
  settingsPersistence: ContextoSettingsPersistence;
}) {
  const [view, setView] = useState<'accounts' | 'manage'>('accounts');
  const [filters, setFilters] = useState<AccountFilters>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [settings, setSettings] = useState<ContextoSettings>(defaultSettings);
  const [newHandle, setNewHandle] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const activeRowRef = useRef<HTMLButtonElement>(null);

  const accounts = useLiveQuery(() => listAccountSummaries(filters), [
    filters.query,
    filters.tagIds,
    filters.folderIds,
    filters.companyIds,
    filters.location,
  ]);
  const lookups = useLiveQuery(() => getLookups(), []);
  useEffect(() => {
    if (!lookups) return;
    setFilters((current) => {
      function prune(ids: string[] | undefined, options: { id: string }[]) {
        if (!ids) return ids;
        const available = new Set(options.map((option) => option.id));
        const next = ids.filter((id) => available.has(id));
        return next.length === ids.length ? ids : next;
      }
      const tagIds = prune(current.tagIds, lookups.tags);
      const folderIds = prune(current.folderIds, lookups.folders);
      const companyIds = prune(current.companyIds, lookups.companies);
      return tagIds === current.tagIds && folderIds === current.folderIds && companyIds === current.companyIds
        ? current : { ...current, tagIds, folderIds, companyIds };
    });
  }, [lookups]);

  const selected = useMemo(() => accounts?.find((account) => account.id === selectedId) ?? accounts?.[0], [accounts, selectedId]);

  useEffect(() => {
    settingsItem.getValue().then((value) => setSettings(normalizeContextoSettings(value)));
  }, []);

  useEffect(() => {
    if (!accounts) return;

    if (accounts.length === 0) {
      setSelectedId(undefined);
      return;
    }

    if (!accounts.some((account) => account.id === selectedId)) {
      setSelectedId(accounts[0].id);
    }
  }, [accounts, selectedId]);

  useEffect(() => {
    if (view !== 'accounts' || !accounts?.length) return;
    const accountIds = accounts.map((account) => account.id);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      const target = event.target;
      if (
        target instanceof HTMLElement
        && (
          target.isContentEditable
          || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
        )
      ) {
        return;
      }

      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      setSelectedId((currentId) => getAdjacentAccountId(accountIds, currentId, offset));
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accounts, view]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected?.id]);

  async function saveSettings(patch: Partial<ContextoSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
    await settingsPersistence.updateSettings(patch);
  }

  async function addAccount() {
    const normalizedHandle = normalizeXHandle(newHandle);
    if (!normalizedHandle) return;

    const account = await ensureAccountFromProfile({
      platform: 'x',
      handle: normalizedHandle,
      displayName: newDisplayName || normalizedHandle,
      profileUrl: `https://x.com/${normalizedHandle}`,
    });
    setSelectedId(account.id);
    setNewHandle('');
    setNewDisplayName('');
    setStatus(`Added @${normalizedHandle}`);
  }

  async function clearTargetHistory() {
    try {
      await clearTargetHandleHistory();
      setStatus('Target handle history cleared');
    } catch {
      setStatus('Could not clear target handle history');
    }
  }

  if (view === 'manage') return <ManageData onBack={() => setView('accounts')} />;

  return (
    <main className="contexto-app">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">C</div>
          <div>
            <h1>Contexto</h1>
            <p>Relationship context for practitioner community work.</p>
          </div>
        </div>

        <button type="button" className="manage-data-link" onClick={() => setView('manage')}>Manage data</button>

        <section className="panel compact-panel">
          <label className="field-label" htmlFor="account-query">Account search</label>
          <div className="input-with-icon">
            <Search size={16} aria-hidden="true" />
            <input
              id="account-query"
              value={filters.query ?? ''}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              placeholder="Handle, company, note, tag"
            />
          </div>

          <p className="filter-help">Accounts must match every selected filter (AND).</p>
          <AccountFilterField label="Circles" options={lookups?.folders ?? []}
            selectedIds={filters.folderIds ?? []}
            onChange={(folderIds) => setFilters((current) => ({ ...current, folderIds }))} />
          <AccountFilterField label="Tags" options={lookups?.tags ?? []}
            selectedIds={filters.tagIds ?? []}
            onChange={(tagIds) => setFilters((current) => ({ ...current, tagIds }))} />
          <AccountFilterField label="Companies" options={lookups?.companies ?? []}
            selectedIds={filters.companyIds ?? []}
            onChange={(companyIds) => setFilters((current) => ({ ...current, companyIds }))} />
          {(filters.companyIds?.length ?? 0) > 1 && (
            <p className="filter-help">Accounts have one company, so multiple companies cannot match all selections.</p>
          )}
          <button type="button" disabled={!filters.query && !filters.folderIds?.length && !filters.tagIds?.length && !filters.companyIds?.length}
            onClick={() => setFilters({})}>Clear filters</button>
        </section>

        <section className="panel compact-panel">
          <h2><UserPlus size={16} aria-hidden="true" /> Add X account</h2>
          <input value={newHandle} onChange={(event) => setNewHandle(event.target.value)} placeholder="@handle" />
          <input value={newDisplayName} onChange={(event) => setNewDisplayName(event.target.value)} placeholder="Display name" />
          <button className="primary-action" onClick={addAccount}><UserPlus size={16} aria-hidden="true" /> Add account</button>
        </section>

        <section className="panel compact-panel">
          <h2><Settings size={16} aria-hidden="true" /> Settings</h2>
          <label className="field-label" htmlFor="my-x-handle">My X handle</label>
          <input
            id="my-x-handle"
            value={settings.myXHandle}
            onChange={(event) => saveSettings({ myXHandle: event.target.value })}
            placeholder="@your_handle"
          />
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={settings.showNativeXSidebarWidgets}
              onChange={(event) => saveSettings({
                showNativeXSidebarWidgets: event.target.checked,
              })}
            />
            Show X sidebar widgets
          </label>
          <button className="clear-history-action" onClick={clearTargetHistory}>
            <Trash2 size={16} aria-hidden="true" /> Clear target handle history
          </button>
          <BackupControls />
          {status && <p className="status-line">{status}</p>}
        </section>
      </aside>

      <section className="account-list" aria-label="Accounts">
        <div className="list-header">
          <h2>Accounts</h2>
          <div className="list-meta">
            <small>↑ ↓ navigate</small>
            <span>{accounts?.length ?? 0}</span>
          </div>
        </div>
        <div className="account-results">
          {accounts?.map((account) => (
            <button
              key={account.id}
              className={account.id === selected?.id ? 'account-row active' : 'account-row'}
              ref={account.id === selected?.id ? activeRowRef : undefined}
              onClick={() => setSelectedId(account.id)}
              aria-current={account.id === selected?.id ? 'true' : undefined}
            >
              <span className="avatar-fallback">{account.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="account-row-content">
                <strong>{account.displayName}</strong>
                <small className="account-row-metadata">
                  <span>@{account.handle}</span>
                  {account.company?.name.trim() && <span className="account-row-company">
                    <span className="metadata-label">Company:</span>
                    <span className="account-row-company-value">{account.company.name}</span>
                  </span>}
                </small>
              </span>
            </button>
          ))}
          {accounts?.length === 0 && <p className="empty-state">No accounts match this filter.</p>}
        </div>
      </section>

      <section className="detail-pane" aria-label="Account details">
        {selected ? <AccountDetail key={selected.id} account={selected} settings={settings}
          companySuggestions={lookups?.companies.map((company) => company.name) ?? []}
          roleSuggestions={lookups?.roles ?? []}
          locationSuggestions={lookups?.locations ?? []} /> : <EmptyDetail />}
      </section>
    </main>
  );
}

function EmptyDetail() {
  return (
    <div className="empty-detail">
      <ArchiveRestore size={36} aria-hidden="true" />
      <h2>No account selected</h2>
      <p>Add an X account or visit an X profile page to start building relationship context.</p>
    </div>
  );
}

function metadataDraftFor(account: AccountSummary) {
  return {
    displayName: account.displayName,
    role: account.role ?? '',
    companyName: account.company?.name ?? '',
    location: account.location ?? '',
    website: account.website ?? '',
    relationshipSource: account.relationshipSource ?? '',
    bioSnapshot: account.bioSnapshot ?? '',
  };
}

function metadataMatchesDraft(account: AccountSummary, draft: ReturnType<typeof metadataDraftFor>) {
  return JSON.stringify(metadataDraftFor(account)) === JSON.stringify(draft);
}

function AccountDetail({
  account,
  settings,
  companySuggestions,
  locationSuggestions,
  roleSuggestions,
}: {
  account: AccountSummary;
  settings: ContextoSettings;
  companySuggestions: string[];
  locationSuggestions: string[];
  roleSuggestions: string[];
}) {
  const [draft, setDraft] = useState(() => metadataDraftFor(account));
  const [draftRevision, setDraftRevision] = useState(account.groupingRevision);
  const [contactRevision, setContactRevision] = useState(account.accountRevision);
  const baselineMetadata = useRef(metadataDraftFor(account));
  const [note, setNote] = useState('');
  const [tagName, setTagName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [folderName, setFolderName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [markingCaughtUp, setMarkingCaughtUp] = useState(false);
  const [catchUpError, setCatchUpError] = useState('');
  const [catchUpSuccess, setCatchUpSuccess] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const catchUpUrl = buildXCatchUpSearchUrl(account.handle, account.lastCatchUpAt);

  useEffect(() => {
    setDraft(metadataDraftFor(account));
    setDraftRevision(account.groupingRevision);
    setContactRevision(account.accountRevision);
    baselineMetadata.current = metadataDraftFor(account);
  }, [account.id]);

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      const saved = await updateAccount(account.id, { ...draft, accountRevision: contactRevision, groupingRevision: draftRevision,
        ...(tagName.trim() ? { addTagNames: [tagName.trim()] } : {}),
        ...(folderName.trim() ? { addFolderNames: [folderName.trim()] } : {}) });
      setDraftRevision(saved.groupingRevision);
      setContactRevision(saved.accountRevision);
      baselineMetadata.current = metadataDraftFor(saved);
      setTagName(''); setFolderName('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save metadata');
    } finally {
      setSaving(false);
    }
  }

  async function reloadSavedMetadata() {
    setSaving(true); setSaveError('');
    try {
      const current = await getAccountSummary(account.id);
      if (!current) throw new Error('Contact no longer exists.');
      setDraft(metadataDraftFor(current));
      setDraftRevision(current.groupingRevision);
      setContactRevision(current.accountRevision);
      baselineMetadata.current = metadataDraftFor(current);
      setTagName(''); setFolderName('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not reload saved values');
    } finally { setSaving(false); }
  }

  async function addTagAndClear() {
    if (!tagName.trim()) return;
    const saved = await assignTag(account.id, tagName.trim());
    if (saved && metadataMatchesDraft(saved, baselineMetadata.current)) setContactRevision(saved.accountRevision);
    setTagName('');
  }

  async function addFolderAndClear() {
    if (!folderName.trim()) return;
    const saved = await assignFolder(account.id, folderName.trim());
    if (saved && metadataMatchesDraft(saved, baselineMetadata.current)) setContactRevision(saved.accountRevision);
    setFolderName('');
  }

  async function removeAssignedTag(tagId: string) {
    await removeTag(account.id, tagId);
  }

  async function removeAssignedFolder(folderId: string) {
    await removeFolder(account.id, folderId);
  }

  async function addNoteAndClear() {
    if (!note.trim()) return;
    await addNote(account.id, note);
    setNote('');
  }

  async function openSearch(direction: SearchDirection) {
    const filters: XSearchFilters = {
      viewerHandle: settings.myXHandle,
      targetHandle: account.handle,
      keyword,
      since,
      until,
      direction,
    };
    const url = buildXSearchUrl(filters);
    await recordSearch(filters, url, account.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function markCaughtUp() {
    setMarkingCaughtUp(true);
    setCatchUpError('');
    setCatchUpSuccess('');
    try {
      await markAccountCaughtUp(account.id);
      setCatchUpSuccess('Catch-up checkpoint updated');
    } catch (error) {
      setCatchUpError(error instanceof Error ? error.message : 'Could not update catch-up checkpoint');
    } finally {
      setMarkingCaughtUp(false);
    }
  }

  async function permanentlyDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(account.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete account');
      setDeleting(false);
    }
  }

  return (
    <div className="detail-grid">
      <header className="profile-heading">
        <span className="avatar-large">{account.displayName.slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{account.displayName}</h2>
          <a href={account.profileUrl} target="_blank" rel="noreferrer">@{account.handle} <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      </header>

      <section className="panel detail-section" aria-label="Contact record details">
        <h3>Contact record details</h3>
        {account.platform === 'x' && account.xUserId && <p><strong>X user ID:</strong> {account.xUserId}</p>}
        {([
          ['Added to Contexto', account.createdAt],
          ['Last updated in Contexto', account.updatedAt],
        ] as const).map(([label, timestamp]) => (
          <p key={label}>
            <strong>{label}:</strong>{' '}
            {Number.isNaN(Date.parse(timestamp)) ? 'Unknown' : <time dateTime={timestamp}>
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))}
            </time>}
          </p>
        ))}
      </section>

      <section className="panel detail-section">
        <h3>Profile metadata</h3>
        <div className="form-grid two-columns">
          <label>Display name<input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
          <FuzzyTextCombobox label="Role" value={draft.role} suggestions={roleSuggestions}
            onChange={(role) => setDraft({ ...draft, role })} />
          <FuzzyTextCombobox label="Company" value={draft.companyName} suggestions={companySuggestions}
            onChange={(companyName) => setDraft({ ...draft, companyName })} />
          <FuzzyTextCombobox label="Location" value={draft.location} suggestions={locationSuggestions}
            onChange={(location) => setDraft({ ...draft, location })} />
          <label>Website<input value={draft.website} onChange={(event) => setDraft({ ...draft, website: event.target.value })} /></label>
          <label>How we know each other<input value={draft.relationshipSource} onChange={(event) => setDraft({ ...draft, relationshipSource: event.target.value })} /></label>
        </div>
        <label>Bio snapshot<textarea rows={3} value={draft.bioSnapshot} onChange={(event) => setDraft({ ...draft, bioSnapshot: event.target.value })} /></label>
        <button className="primary-action" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save metadata'}</button>
        {saveError && <><p role="alert">{saveError}</p><button type="button" disabled={saving} onClick={reloadSavedMetadata}>Reload saved values</button></>}
      </section>

      <section className="panel detail-section split-section">
        <div>
          <h3><Tag size={16} aria-hidden="true" /> Tags</h3>
          <div className="inline-form"><input disabled={saving} value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Add tag" /><button disabled={saving} onClick={addTagAndClear}>Add</button></div>
          <div className="chip-row">{account.tags.map((tag) => (
            <span className="chip" key={tag.id}>
              {tag.name}
              <button type="button" aria-label={`Remove ${tag.name} from Tags`}
                onClick={() => removeAssignedTag(tag.id)}>×</button>
            </span>
          ))}</div>
        </div>
        <div>
          <h3><UsersRound size={16} aria-hidden="true" /> Circles</h3>
          <div className="inline-form"><input disabled={saving} value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Add circle" /><button disabled={saving} onClick={addFolderAndClear}>Add</button></div>
          <div className="chip-row">{account.folders.map((folder) => (
            <span className="chip folder-chip" key={folder.id}>
              {folder.name}
              <button type="button" aria-label={`Remove ${folder.name} from Circles`}
                onClick={() => removeAssignedFolder(folder.id)}>×</button>
            </span>
          ))}</div>
        </div>
      </section>

      <section className="panel detail-section">
        <h3>Notes</h3>
        {account.latestNote?.body.trim() && <p className="latest-note">
          <strong className="metadata-label">Latest note:</strong>
          <span className="latest-note-value">{account.latestNote.body}</span>
        </p>}
        <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context, follow-up ideas, or relationship history" />
        <button onClick={addNoteAndClear}>Add note</button>
      </section>

      <section className="panel detail-section">
        <h3><RefreshCw size={16} aria-hidden="true" /> Catch up</h3>
        {account.lastCatchUpAt && catchUpUrl
          ? <time dateTime={account.lastCatchUpAt}>
            Last caught up {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(account.lastCatchUpAt))}
          </time>
          : <p className="catch-up-status">No catch-up checkpoint yet.</p>}
        <div className="catch-up-actions">
          {catchUpUrl && <a
            className="dashboard-link-action"
            href={catchUpUrl}
            target="_blank"
            rel="noopener noreferrer"
          >Catch up on X <ExternalLink size={14} aria-hidden="true" /></a>}
          <button type="button" disabled={markingCaughtUp} onClick={markCaughtUp}>
            {markingCaughtUp ? 'Updating…' : 'Mark caught up'}
          </button>
        </div>
        {catchUpError && <p className="error-line" role="alert">{catchUpError}</p>}
        {catchUpSuccess && <p className="status-line" aria-live="polite">{catchUpSuccess}</p>}
      </section>

      <AccountBookmarks accountId={account.id} />

      <section className="panel detail-section">
        <h3><Search size={16} aria-hidden="true" /> X search</h3>
        <div className="form-grid three-columns">
          <label>Keyword<input value={keyword} onChange={(event) => setKeyword(event.target.value)} /></label>
          <label>Since<input type="date" value={since} onChange={(event) => setSince(event.target.value)} /></label>
          <label>Until<input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
        </div>
        <div className="search-actions">
          {searchDirections.map((direction) => {
            const filters: XSearchFilters = { viewerHandle: settings.myXHandle, targetHandle: account.handle, keyword, since, until, direction };
            return (
              <button key={direction} title={buildXSearchQuery(filters)} onClick={() => openSearch(direction)}>
                <Search size={15} aria-hidden="true" /> {labelSearchDirection(direction)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel detail-section danger-section">
        <h3><Trash2 size={16} aria-hidden="true" /> Delete account</h3>
        {!deleteConfirmation ? <>
          <p>Permanently remove this account and its saved Contexto data.</p>
          <button type="button" className="danger-action" onClick={() => {
            setDeleteConfirmation(true);
            setDeleteError('');
          }}>
            <Trash2 size={16} aria-hidden="true" /> Delete account
          </button>
        </> : <>
          <p className="danger-warning">
            This permanently deletes @{account.handle}, including profile metadata, notes, bookmarks, search history, and tag/circle assignments. Shared company, tag, and circle definitions remain available to other accounts.
          </p>
          <div className="delete-actions">
            <button type="button" disabled={deleting} onClick={() => setDeleteConfirmation(false)}>Cancel</button>
            <button type="button" className="danger-action" disabled={deleting} onClick={permanentlyDeleteAccount}>
              <Trash2 size={16} aria-hidden="true" /> {deleting ? 'Deleting…' : `Delete @${account.handle} permanently`}
            </button>
          </div>
          {deleteError && <p className="error-line" role="alert">{deleteError}</p>}
        </>}
      </section>
    </div>
  );
}

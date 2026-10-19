import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArchiveRestore,
  Building2,
  Download,
  ExternalLink,
  FolderPlus,
  RefreshCw,
  Search,
  Settings,
  Tag,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import {
  addNote,
  assignFolder,
  assignTag,
  ensureAccountFromProfile,
  exportBackup,
  getLookups,
  importBackup,
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
import type { AccountFilters, AccountSummary, ContextoSettings, SearchDirection, XSearchFilters } from '@/src/shared/types';
import { getAdjacentAccountId } from './account-navigation';
import { AccountBookmarks } from './AccountBookmarks';
import { FuzzyTextCombobox } from './FuzzyTextCombobox';

const searchDirections: SearchDirection[] = ['me-to-them', 'them-to-me', 'from-profile', 'to-profile', 'mentions'];

export function Dashboard() {
  const [filters, setFilters] = useState<AccountFilters>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [settings, setSettings] = useState<ContextoSettings>(defaultSettings);
  const [newHandle, setNewHandle] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const activeRowRef = useRef<HTMLButtonElement>(null);

  const accounts = useLiveQuery(() => listAccountSummaries(filters), [
    filters.query,
    filters.tagId,
    filters.folderId,
    filters.companyId,
    filters.location,
  ]);
  const lookups = useLiveQuery(() => getLookups(), []);
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
    if (!accounts?.length) return;
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
  }, [accounts]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected?.id]);

  async function saveSettings(next: ContextoSettings) {
    setSettings(next);
    await settingsItem.setValue(next);
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

  async function downloadBackup() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contexto-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Backup exported');
  }

  async function uploadBackup(file?: File) {
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    await importBackup(parsed);
    setStatus('Backup imported');
  }

  async function clearTargetHistory() {
    try {
      await clearTargetHandleHistory();
      setStatus('Target handle history cleared');
    } catch {
      setStatus('Could not clear target handle history');
    }
  }

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

          <label className="field-label" htmlFor="folder-filter">Folder</label>
          <select id="folder-filter" value={filters.folderId ?? ''} onChange={(event) => setFilters({ ...filters, folderId: event.target.value || undefined })}>
            <option value="">All folders</option>
            {lookups?.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>

          <label className="field-label" htmlFor="tag-filter">Tag</label>
          <select id="tag-filter" value={filters.tagId ?? ''} onChange={(event) => setFilters({ ...filters, tagId: event.target.value || undefined })}>
            <option value="">All tags</option>
            {lookups?.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>

          <label className="field-label" htmlFor="company-filter">Company</label>
          <select id="company-filter" value={filters.companyId ?? ''} onChange={(event) => setFilters({ ...filters, companyId: event.target.value || undefined })}>
            <option value="">All companies</option>
            {lookups?.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
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
            onChange={(event) => saveSettings({ ...settings, myXHandle: event.target.value })}
            placeholder="@your_handle"
          />
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={settings.showNativeXSidebarWidgets}
              onChange={(event) => saveSettings({
                ...settings,
                showNativeXSidebarWidgets: event.target.checked,
              })}
            />
            Show X sidebar widgets
          </label>
          <button className="clear-history-action" onClick={clearTargetHistory}>
            <Trash2 size={16} aria-hidden="true" /> Clear target handle history
          </button>
          <div className="backup-actions">
            <button onClick={downloadBackup}><Download size={16} aria-hidden="true" /> Export</button>
            <label className="file-button">
              <Upload size={16} aria-hidden="true" /> Import
              <input type="file" accept="application/json" onChange={(event) => uploadBackup(event.target.files?.[0])} />
            </label>
          </div>
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
                    <span>{account.company.name}</span>
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

function AccountDetail({
  account,
  settings,
  companySuggestions,
  locationSuggestions,
}: {
  account: AccountSummary;
  settings: ContextoSettings;
  companySuggestions: string[];
  locationSuggestions: string[];
}) {
  const [draft, setDraft] = useState({
    displayName: account.displayName,
    role: account.role ?? '',
    companyName: account.company?.name ?? '',
    location: account.location ?? '',
    relationshipSource: account.relationshipSource ?? '',
    bioSnapshot: account.bioSnapshot ?? '',
  });
  const [note, setNote] = useState('');
  const [tagName, setTagName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [markingCaughtUp, setMarkingCaughtUp] = useState(false);
  const [catchUpError, setCatchUpError] = useState('');
  const [catchUpSuccess, setCatchUpSuccess] = useState('');
  const catchUpUrl = buildXCatchUpSearchUrl(account.handle, account.lastCatchUpAt);

  useEffect(() => {
    setDraft({
      displayName: account.displayName,
      role: account.role ?? '',
      companyName: account.company?.name ?? '',
      location: account.location ?? '',
      relationshipSource: account.relationshipSource ?? '',
      bioSnapshot: account.bioSnapshot ?? '',
    });
  }, [account.id]);

  async function save() {
    await updateAccount(account.id, draft);
  }

  async function addTagAndClear() {
    if (!tagName.trim()) return;
    await assignTag(account.id, tagName);
    setTagName('');
  }

  async function addFolderAndClear() {
    if (!folderName.trim()) return;
    await assignFolder(account.id, folderName);
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

  return (
    <div className="detail-grid">
      <header className="profile-heading">
        <span className="avatar-large">{account.displayName.slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{account.displayName}</h2>
          <a href={account.profileUrl} target="_blank" rel="noreferrer">@{account.handle} <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      </header>

      <section className="panel detail-section">
        <h3>Profile metadata</h3>
        <div className="form-grid two-columns">
          <label>Display name<input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
          <label>Role<input value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} /></label>
          <FuzzyTextCombobox label="Company" value={draft.companyName} suggestions={companySuggestions}
            onChange={(companyName) => setDraft({ ...draft, companyName })} />
          <FuzzyTextCombobox label="Location" value={draft.location} suggestions={locationSuggestions}
            onChange={(location) => setDraft({ ...draft, location })} />
          <label>How we know each other<input value={draft.relationshipSource} onChange={(event) => setDraft({ ...draft, relationshipSource: event.target.value })} /></label>
        </div>
        <label>Bio snapshot<textarea rows={3} value={draft.bioSnapshot} onChange={(event) => setDraft({ ...draft, bioSnapshot: event.target.value })} /></label>
        <button className="primary-action" onClick={save}>Save metadata</button>
      </section>

      <section className="panel detail-section split-section">
        <div>
          <h3><Tag size={16} aria-hidden="true" /> Tags</h3>
          <div className="chip-row">{account.tags.map((tag) => (
            <span className="chip" key={tag.id}>
              {tag.name}
              <button type="button" aria-label={`Remove ${tag.name} from Tags`}
                onClick={() => removeAssignedTag(tag.id)}>×</button>
            </span>
          ))}</div>
          <div className="inline-form"><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Add tag" /><button onClick={addTagAndClear}>Add</button></div>
        </div>
        <div>
          <h3><FolderPlus size={16} aria-hidden="true" /> Folders</h3>
          <div className="chip-row">{account.folders.map((folder) => (
            <span className="chip folder-chip" key={folder.id}>
              {folder.name}
              <button type="button" aria-label={`Remove ${folder.name} from Folders`}
                onClick={() => removeAssignedFolder(folder.id)}>×</button>
            </span>
          ))}</div>
          <div className="inline-form"><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Add folder" /><button onClick={addFolderAndClear}>Add</button></div>
        </div>
      </section>

      <section className="panel detail-section">
        <h3>Notes</h3>
        {account.latestNote?.body.trim() && <p className="latest-note">
          <strong className="metadata-label">Latest note:</strong>
          <span>{account.latestNote.body}</span>
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
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ExternalLink, FolderPlus, Save, Search, Tag } from 'lucide-react';
import { buildXSearchQuery, buildXSearchUrl, labelSearchDirection } from '@/src/shared/platforms/x';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { AccountSummary, ContextoSettings, ProfileSnapshot, SearchDirection, XSearchFilters } from '@/src/shared/types';

const searchDirections: SearchDirection[] = ['me-to-them', 'them-to-me', 'from-profile', 'mentions'];

async function send(message: ContextoRequest): Promise<ContextoResponse> {
  return browser.runtime.sendMessage(message);
}

export function ProfilePanel({ profile }: { profile: ProfileSnapshot | null }) {
  const [account, setAccount] = useState<AccountSummary>();
  const [settings, setSettings] = useState<ContextoSettings>({ myXHandle: '', lastDashboardView: 'accounts' });
  const [draft, setDraft] = useState({ profession: '', position: '', companyName: '', location: '', relationshipSource: '' });
  const [note, setNote] = useState('');
  const [tagName, setTagName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) {
      setAccount(undefined);
      return;
    }

    let cancelled = false;
    const currentProfile = profile;
    async function load() {
      setError('');
      const [accountResponse, settingsResponse] = await Promise.all([
        send({ type: 'contexto:account:ensure', profile: currentProfile }),
        send({ type: 'contexto:settings:get' }),
      ]);

      if (cancelled) return;
      if (accountResponse.ok && 'account' in accountResponse) {
        setAccount(accountResponse.account);
        setDraft({
          profession: accountResponse.account.profession ?? '',
          position: accountResponse.account.position ?? '',
          companyName: accountResponse.account.company?.name ?? '',
          location: accountResponse.account.location ?? '',
          relationshipSource: accountResponse.account.relationshipSource ?? '',
        });
      } else {
        setError(!accountResponse.ok ? accountResponse.error : 'Contexto did not return an account');
      }
      if (settingsResponse.ok && 'settings' in settingsResponse) setSettings(settingsResponse.settings);
    }

    load().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load Contexto profile'));
    return () => {
      cancelled = true;
    };
  }, [profile?.profileUrl]);

  if (!profile) {
    return <aside className="contexto-panel collapsed">Contexto</aside>;
  }

  if (!account) {
    return <aside className="contexto-panel"><strong>Contexto</strong><p>{error || 'Loading profile context...'}</p></aside>;
  }

  async function refresh(response: ContextoResponse) {
    if (response.ok && 'account' in response) setAccount(response.account);
    if (!response.ok) setError(response.error);
  }

  async function saveMetadata() {
    await refresh(await send({ type: 'contexto:account:update', accountId: account!.id, patch: draft }));
  }

  async function addNote() {
    if (!note.trim()) return;
    await refresh(await send({ type: 'contexto:note:add', accountId: account!.id, body: note }));
    setNote('');
  }

  async function addTag() {
    if (!tagName.trim()) return;
    await refresh(await send({ type: 'contexto:tag:assign', accountId: account!.id, name: tagName }));
    setTagName('');
  }

  async function addFolder() {
    if (!folderName.trim()) return;
    await refresh(await send({ type: 'contexto:folder:assign', accountId: account!.id, name: folderName }));
    setFolderName('');
  }

  async function openSearch(direction: SearchDirection) {
    const filters: XSearchFilters = {
      viewerHandle: settings.myXHandle,
      targetHandle: account!.handle,
      keyword,
      since,
      until,
      direction,
    };
    const url = buildXSearchUrl(filters);
    await send({ type: 'contexto:search:record', accountId: account!.id, filters, query: buildXSearchQuery(filters), url });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openDashboard() {
    browser.runtime.openOptionsPage();
  }

  return (
    <aside className="contexto-panel" aria-label="Contexto profile panel">
      <header>
        <div>
          <strong>Contexto</strong>
          <p>@{account!.handle}</p>
        </div>
        <button className="icon-button" onClick={openDashboard} title="Open Contexto dashboard"><ExternalLink size={16} aria-hidden="true" /></button>
      </header>

      <section>
        <label>Profession<input value={draft.profession} onChange={(event) => setDraft({ ...draft, profession: event.target.value })} /></label>
        <label>Position<input value={draft.position} onChange={(event) => setDraft({ ...draft, position: event.target.value })} /></label>
        <label>Company<input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} /></label>
        <label>Location<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
        <label>How we met<input value={draft.relationshipSource} onChange={(event) => setDraft({ ...draft, relationshipSource: event.target.value })} /></label>
        <button className="primary-action" onClick={saveMetadata}><Save size={15} aria-hidden="true" /> Save</button>
      </section>

      <section className="mini-section">
        <div className="chip-row">{account.tags.map((tag) => <span className="chip" key={tag.id}>{tag.name}</span>)}</div>
        <div className="inline-form"><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Tag" /><button onClick={addTag}><Tag size={14} aria-hidden="true" /></button></div>
        <div className="chip-row">{account.folders.map((folder) => <span className="chip folder-chip" key={folder.id}>{folder.name}</span>)}</div>
        <div className="inline-form"><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Folder" /><button onClick={addFolder}><FolderPlus size={14} aria-hidden="true" /></button></div>
      </section>

      <section className="mini-section">
        {account.latestNote && <p className="latest-note">{account.latestNote.body}</p>}
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" />
        <button onClick={addNote}>Add note</button>
      </section>

      <section className="mini-section">
        <div className="search-grid">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Keyword" />
          <input type="date" value={since} onChange={(event) => setSince(event.target.value)} />
          <input type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
        </div>
        <div className="panel-search-actions">
          {searchDirections.map((direction) => (
            <button key={direction} onClick={() => openSearch(direction)} title={labelSearchDirection(direction)}>
              <Search size={14} aria-hidden="true" /> {labelSearchDirection(direction)}
            </button>
          ))}
        </div>
      </section>
      {error && <p className="error-line">{error}</p>}
    </aside>
  );
}

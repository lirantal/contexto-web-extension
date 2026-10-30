import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportBackup, importBackup, previewBackup, type BackupPreview } from '../data/repositories';
import { canonicalRecord } from '../data/record-revision';
import type { BackupEnvelope } from '../shared/types';

function download(envelope: BackupEnvelope, label = 'backup') {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `contexto-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  // Give the browser time to consume the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupControls() {
  const [preview, setPreview] = useState<BackupPreview>();
  const [mode, setMode] = useState<'merge' | 'restore'>('merge');
  const [pending, setPending] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [confirmedRecovery, setConfirmedRecovery] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const selection = useRef(0);

  async function exportFile() {
    setPending(true); setError('');
    try { download(await exportBackup()); setStatus('Backup download requested. Check that the JSON file was saved.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not export backup'); }
    finally { setPending(false); }
  }
  async function selectFile(file?: File) {
    const attempt = ++selection.current;
    setPreview(undefined); setRecoveryReady(false); setConfirmedRecovery(false); setMode('merge'); setStatus(''); setError('');
    if (!file) return;
    setPending(true);
    try {
      const result = await previewBackup(JSON.parse(await file.text()));
      if (attempt === selection.current) setPreview(result);
    } catch (caught) {
      if (attempt === selection.current) setError(caught instanceof Error ? caught.message : 'Could not read backup');
    } finally { if (attempt === selection.current) setPending(false); }
  }
  async function exportRecovery() {
    if (!preview) return;
    setPending(true); setError(''); setRecoveryReady(false); setConfirmedRecovery(false);
    try {
      const current = await exportBackup();
      if (canonicalRecord(current.data) !== preview.databaseRevision) {
        throw new Error('Local data changed. Select the backup file again to refresh the preview.');
      }
      download(current, 'before-import'); setRecoveryReady(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not export recovery backup'); }
    finally { setPending(false); }
  }
  async function apply() {
    if (!preview || !confirmedRecovery || !recoveryReady) return;
    setPending(true); setError('');
    try {
      await importBackup(preview.envelope, undefined, { mode, expectedDatabaseRevision: preview.databaseRevision });
      setPreview(undefined); setStatus(mode === 'restore' ? 'Database restored from backup.' : 'Backup merged without overwriting saved records.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not import backup'); }
    finally { setPending(false); }
  }
  return <section aria-label="Backup and restore">
    <div className="backup-actions">
      <button type="button" disabled={pending} onClick={exportFile}><Download size={16} aria-hidden="true" /> Export</button>
      <label className="file-button"><Upload size={16} aria-hidden="true" /> Import
        <input type="file" accept="application/json" disabled={pending} onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ''; void selectFile(file);
        }} />
      </label>
    </div>
    <p className="filter-help">Backups contain all contact database records and fields. Settings are separate. Keep JSON copies outside your browser profile; uninstalling Contexto can remove local data.</p>
    {preview && <div role="group" aria-label="Import preview">
      <p>{preview.envelope.data.accounts.length} contacts; {preview.added} new, {preview.unchanged} identical, {preview.conflicts} conflicting records across all tables.</p>
      <label>Import mode<select disabled={pending} value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
        <option value="merge">Safe merge — add records, refuse overwrites</option>
        <option value="restore">Full restore — replace the contact database</option>
      </select></label>
      {mode === 'restore'
        ? <p>This replaces all {preview.currentRecords} current database records with {preview.incomingRecords} backup records. Data absent from the backup is removed. Settings stay as they are.</p>
        : <p>Existing records stay intact. Conflicts or duplicate identities cancel the entire import. Previously deleted records can be added again.</p>}
      <button type="button" disabled={pending} onClick={exportRecovery}>Download recovery backup</button>
      <label><input type="checkbox" disabled={pending || !recoveryReady} checked={confirmedRecovery} onChange={(event) => setConfirmedRecovery(event.target.checked)} />I verified that the recovery JSON file was saved</label>
      <div className="backup-actions">
        <button type="button" disabled={pending || !confirmedRecovery || (mode === 'merge' && preview.conflicts > 0)} onClick={apply}>
          {mode === 'restore' ? 'Replace database with this backup' : 'Merge backup safely'}
        </button>
        <button type="button" disabled={pending} onClick={() => { selection.current++; setPreview(undefined); setError(''); }}>Cancel import</button>
      </div>
    </div>}
    {pending && <p role="status">Working…</p>}
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

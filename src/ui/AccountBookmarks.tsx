import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { listBookmarks, removeBookmark, updateBookmark } from '@/src/data/repositories';
import type { Bookmark, BookmarkUpdateInput } from '@/src/shared/types';

export interface AccountBookmarksProps {
  accountId: string;
  load?: (accountId: string) => Promise<Bookmark[]>;
  update?: (bookmarkId: string, input: BookmarkUpdateInput) => Promise<Bookmark>;
  remove?: (bookmarkId: string) => Promise<void>;
}

export function AccountBookmarks({
  accountId,
  load = listBookmarks,
  update = updateBookmark,
  remove = removeBookmark,
}: AccountBookmarksProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>();
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [reminderDraft, setReminderDraft] = useState('');
  const [updatingId, setUpdatingId] = useState<string>();
  const [removingId, setRemovingId] = useState<string>();
  const requestRef = useRef(0);
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;

  useEffect(() => {
    const request = ++requestRef.current;
    setBookmarks(undefined);
    setError('');
    setEditingId(undefined);
    setReminderDraft('');
    setUpdatingId(undefined);
    setRemovingId(undefined);
    load(accountId)
      .then((records) => {
        if (request === requestRef.current) setBookmarks(records);
      })
      .catch((caught) => {
        if (request !== requestRef.current) return;
        setBookmarks([]);
        setError(caught instanceof Error ? caught.message : 'Could not load bookmarks');
      });
    return () => { requestRef.current += 1; };
  }, [accountId, load]);

  function startEditing(bookmark: Bookmark) {
    setEditingId(bookmark.id);
    setReminderDraft(bookmark.reminder ?? '');
    setError('');
  }

  function cancelEditing() {
    setEditingId(undefined);
    setReminderDraft('');
    setError('');
  }

  async function updateAndReplace(bookmarkId: string, input: BookmarkUpdateInput): Promise<boolean> {
    const operationAccountId = accountId;
    setUpdatingId(bookmarkId);
    setError('');
    try {
      const updated = await update(bookmarkId, input);
      if (accountIdRef.current !== operationAccountId) return false;
      setBookmarks((current) => current?.map((bookmark) => bookmark.id === bookmarkId ? updated : bookmark));
      return true;
    } catch (caught) {
      if (accountIdRef.current === operationAccountId) {
        setError(caught instanceof Error ? caught.message : 'Could not update bookmark');
      }
      return false;
    } finally {
      if (accountIdRef.current === operationAccountId) setUpdatingId(undefined);
    }
  }

  async function saveReminder(bookmarkId: string) {
    if (await updateAndReplace(bookmarkId, { reminder: reminderDraft })) {
      setEditingId(undefined);
      setReminderDraft('');
    }
  }

  async function toggleCompleted(bookmark: Bookmark) {
    await updateAndReplace(bookmark.id, { completed: !bookmark.completedAt });
  }

  async function removeAndReload(bookmarkId: string) {
    const operationAccountId = accountId;
    setRemovingId(bookmarkId);
    setError('');
    try {
      await remove(bookmarkId);
      if (accountIdRef.current !== operationAccountId) return;
      const request = ++requestRef.current;
      const records = await load(operationAccountId);
      if (request === requestRef.current && accountIdRef.current === operationAccountId) setBookmarks(records);
    } catch (caught) {
      if (accountIdRef.current === operationAccountId) {
        setError(caught instanceof Error ? caught.message : 'Could not remove bookmark');
      }
    } finally {
      if (accountIdRef.current === operationAccountId) setRemovingId(undefined);
    }
  }

  return <section className="panel detail-section" aria-labelledby="account-bookmarks-heading">
    <h3 id="account-bookmarks-heading">Bookmarks</h3>
    {bookmarks === undefined && <p role="status">Loading bookmarks…</p>}
    {error && <p className="error-line" role="alert">{error}</p>}
    {bookmarks?.length === 0 && !error && <p className="empty-state">Capture posts from saved contacts on X to keep useful references here.</p>}
    {bookmarks && bookmarks.length > 0 && <div className="bookmark-list">
      {bookmarks.map((bookmark) => {
        const editing = editingId === bookmark.id;
        const updating = updatingId === bookmark.id;
        const removing = removingId === bookmark.id;
        const anyOperationPending = Boolean(updatingId || removingId);
        return <article className={`bookmark-card${bookmark.completedAt ? ' handled' : ''}`} key={bookmark.id}>
          {editing ? <div className="bookmark-reminder-editor">
            <label>
              Reminder
              <textarea
                aria-label="Bookmark reminder"
                maxLength={500}
                rows={3}
                value={reminderDraft}
                disabled={updating}
                onChange={(event) => setReminderDraft(event.target.value)}
              />
            </label>
            <div className="bookmark-edit-actions">
              <button
                type="button"
                className="primary-action"
                disabled={updating}
                onClick={() => saveReminder(bookmark.id)}
              >
                {updating ? 'Saving…' : 'Save reminder'}
              </button>
              <button type="button" disabled={updating} onClick={cancelEditing}>Cancel</button>
            </div>
          </div> : <div className="bookmark-reminder-row">
            {bookmark.reminder
              ? <strong>{bookmark.reminder}</strong>
              : <span className="bookmark-empty-reminder">No reminder</span>}
            <button
              type="button"
              aria-label="Edit reminder"
              disabled={anyOperationPending}
              onClick={() => startEditing(bookmark)}
            >
              <Pencil size={14} aria-hidden="true" /> Edit
            </button>
          </div>}
          {bookmark.excerpt && <p className="bookmark-excerpt">{bookmark.excerpt}</p>}
          {bookmark.completedAt && <span className="bookmark-handled">
            <CheckCircle2 size={14} aria-hidden="true" />
            Handled <time dateTime={bookmark.completedAt}>
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(bookmark.completedAt))}
            </time>
          </span>}
          <div className="bookmark-meta">
            <time dateTime={bookmark.capturedAt}>
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(bookmark.capturedAt))}
            </time>
            <a href={bookmark.postUrl} target="_blank" rel="noreferrer">
              Open on X <ExternalLink size={14} aria-hidden="true" />
            </a>
            <button
              type="button"
              disabled={anyOperationPending || editing}
              onClick={() => toggleCompleted(bookmark)}
            >
              {bookmark.completedAt
                ? <><RotateCcw size={14} aria-hidden="true" /> Reopen</>
                : <><CheckCircle2 size={14} aria-hidden="true" /> Mark handled</>}
            </button>
            <button
              type="button"
              aria-label="Remove bookmark"
              disabled={anyOperationPending || editing}
              onClick={() => removeAndReload(bookmark.id)}
            >
              <Trash2 size={14} aria-hidden="true" /> {removing ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </article>;
      })}
    </div>}
  </section>;
}

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { listBookmarks, removeBookmark } from '@/src/data/repositories';
import type { Bookmark } from '@/src/shared/types';

export interface AccountBookmarksProps {
  accountId: string;
  load?: (accountId: string) => Promise<Bookmark[]>;
  remove?: (bookmarkId: string) => Promise<void>;
}

export function AccountBookmarks({
  accountId,
  load = listBookmarks,
  remove = removeBookmark,
}: AccountBookmarksProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>();
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string>();
  const requestRef = useRef(0);

  useEffect(() => {
    const request = ++requestRef.current;
    setBookmarks(undefined);
    setError('');
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

  async function removeAndReload(bookmarkId: string) {
    setRemovingId(bookmarkId);
    setError('');
    try {
      await remove(bookmarkId);
      const request = ++requestRef.current;
      const records = await load(accountId);
      if (request === requestRef.current) setBookmarks(records);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove bookmark');
    } finally {
      setRemovingId(undefined);
    }
  }

  return <section className="panel detail-section" aria-labelledby="account-bookmarks-heading">
    <h3 id="account-bookmarks-heading">Bookmarks</h3>
    {bookmarks === undefined && <p role="status">Loading bookmarks…</p>}
    {error && <p className="error-line" role="alert">{error}</p>}
    {bookmarks?.length === 0 && !error && <p className="empty-state">Capture posts from saved contacts on X to keep useful references here.</p>}
    {bookmarks && bookmarks.length > 0 && <div className="bookmark-list">
      {bookmarks.map((bookmark) => <article className="bookmark-card" key={bookmark.id}>
        {bookmark.reminder && <strong>{bookmark.reminder}</strong>}
        {bookmark.excerpt && <p>{bookmark.excerpt}</p>}
        <div className="bookmark-meta">
          <time dateTime={bookmark.capturedAt}>
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(bookmark.capturedAt))}
          </time>
          <a href={bookmark.postUrl} target="_blank" rel="noreferrer">
            Open on X <ExternalLink size={14} aria-hidden="true" />
          </a>
          <button
            type="button"
            aria-label="Remove bookmark"
            disabled={removingId === bookmark.id}
            onClick={() => removeAndReload(bookmark.id)}
          >
            <Trash2 size={14} aria-hidden="true" /> {removingId === bookmark.id ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </article>)}
    </div>}
  </section>;
}

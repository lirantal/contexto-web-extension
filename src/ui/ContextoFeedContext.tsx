import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildXCatchUpSearchUrl, buildXInteractionSearchUrl } from '@/src/shared/platforms/x';
import type { AccountSummary, ProfileSnapshot, XPostSnapshot } from '@/src/shared/types';
import type { ContextoProfileSurfaceProps } from './ContextoProfileSurface';
import { FeedGroupingsEditor } from './FeedGroupingsEditor';

export interface ContextoFeedContextProps {
  profile: ProfileSnapshot;
  post?: XPostSnapshot;
  send: ContextoProfileSurfaceProps['send'];
  onEdit(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void;
  panelContainer?: HTMLElement;
}

type BookmarkState = 'unavailable' | 'loading' | 'available' | 'saved';

export function ContextoFeedContext({ profile, post, send, onEdit, panelContainer }: ContextoFeedContextProps) {
  const [account, setAccount] = useState<AccountSummary>();
  const [viewerHandle, setViewerHandle] = useState('');
  const [open, setOpen] = useState(false);
  const [editingGroupings, setEditingGroupings] = useState(false);
  const [groupingsSuccess, setGroupingsSuccess] = useState('');
  const [bookmarkState, setBookmarkState] = useState<BookmarkState>('unavailable');
  const [composerOpen, setComposerOpen] = useState(false);
  const [reminder, setReminder] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookmarkError, setBookmarkError] = useState('');
  const [bookmarkSuccess, setBookmarkSuccess] = useState('');
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [noteSuccess, setNoteSuccess] = useState('');
  const [markingCaughtUp, setMarkingCaughtUp] = useState(false);
  const [catchUpError, setCatchUpError] = useState('');
  const [catchUpSuccess, setCatchUpSuccess] = useState('');
  const markerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setAccount(undefined);
    setOpen(false);
    setEditingGroupings(false);
    setGroupingsSuccess('');
    setBookmarkState(post ? 'loading' : 'unavailable');
    setComposerOpen(false);
    setReminder('');
    setBookmarkError('');
    setBookmarkSuccess('');
    setNoteComposerOpen(false);
    setNoteBody('');
    setSavingNote(false);
    setNoteError('');
    setNoteSuccess('');
    setMarkingCaughtUp(false);
    setCatchUpError('');
    setCatchUpSuccess('');
    setViewerHandle('');
    send({ type: 'contexto:settings:get' })
      .then((response) => {
        if (!cancelled && response.ok && 'settings' in response) {
          setViewerHandle(response.settings.myXHandle);
        }
      })
      .catch(() => undefined);
    send({ type: 'contexto:account:lookup', platform: 'x', handle: profile.handle })
      .then(async (response) => {
        if (cancelled || !response.ok || !('lookup' in response)) return;
        const found = response.lookupAccount;
        setAccount(found);
        if (!found || !post) {
          setBookmarkState('unavailable');
          return;
        }
        try {
          const bookmarkResponse = await send({
            type: 'contexto:bookmark:lookup',
            accountId: found.id,
            postUrl: post.postUrl,
          });
          if (cancelled) return;
          if (bookmarkResponse.ok && 'bookmarkLookup' in bookmarkResponse) {
            setBookmarkState(bookmarkResponse.lookupBookmark ? 'saved' : 'available');
          } else {
            setBookmarkState('unavailable');
          }
        } catch {
          if (!cancelled) setBookmarkState('unavailable');
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [profile.handle, post?.postUrl, send]);

  useEffect(() => {
    if (open) return;
    setEditingGroupings(false);
    setGroupingsSuccess('');
    setComposerOpen(false);
    setReminder('');
    setBookmarkError('');
    setNoteComposerOpen(false);
    setNoteBody('');
    setNoteError('');
    setNoteSuccess('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnPointerOutside = (event: PointerEvent) => {
      const path = event.composedPath();
      const insideMarker = markerRef.current ? path.includes(markerRef.current) : false;
      const insidePanel = panelRef.current ? path.includes(panelRef.current) : false;
      if (!insideMarker && !insidePanel) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnPointerOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!account) return null;

  const panelId = `contexto-feed-context-${account.id}`;
  const tags = account.tags.filter((tag) => tag.name.trim());
  const folders = account.folders.filter((folder) => folder.name.trim());
  const interactionUrl = buildXInteractionSearchUrl(viewerHandle, account.handle);
  const catchUpUrl = buildXCatchUpSearchUrl(account.handle, account.lastCatchUpAt);
  const openEditor = () => {
    if (markerRef.current) {
      setOpen(false);
      onEdit(profile, markerRef.current);
    }
  };
  const togglePanel = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!open) {
      setGroupingsSuccess('');
      setEditingGroupings(true);
    }
    setOpen(!open);
  };
  const openComposer = () => {
    setBookmarkError('');
    setBookmarkSuccess('');
    setComposerOpen(true);
  };
  const cancelComposer = () => {
    setComposerOpen(false);
    setReminder('');
    setBookmarkError('');
  };
  const saveBookmark = async () => {
    if (!account || !post || bookmarkState !== 'available') return;
    setSaving(true);
    setBookmarkError('');
    setBookmarkSuccess('');
    try {
      const response = await send({
        type: 'contexto:bookmark:capture',
        accountId: account.id,
        authorHandle: post.authorHandle,
        postUrl: post.postUrl,
        excerpt: post.excerpt,
        reminder,
      });
      if (response.ok && 'bookmark' in response) {
        setBookmarkState('saved');
        setComposerOpen(false);
        setReminder('');
        setBookmarkSuccess('Bookmark saved');
        return;
      }
      setBookmarkError(!response.ok ? response.error : 'Could not save bookmark');
    } catch (error) {
      setBookmarkError(error instanceof Error ? error.message : 'Could not save bookmark');
    } finally {
      setSaving(false);
    }
  };
  const openNoteComposer = () => {
    setNoteError('');
    setNoteSuccess('');
    setNoteComposerOpen(true);
  };
  const cancelNoteComposer = () => {
    setNoteComposerOpen(false);
    setNoteBody('');
    setNoteError('');
  };
  const saveQuickNote = async () => {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    setNoteError('');
    setNoteSuccess('');
    try {
      const response = await send({
        type: 'contexto:note:add',
        accountId: account.id,
        body: noteBody,
      });
      if (response.ok && 'account' in response) {
        setAccount(response.account);
        setNoteComposerOpen(false);
        setNoteBody('');
        setNoteSuccess('Note saved');
        return;
      }
      setNoteError(!response.ok ? response.error : 'Could not save note');
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : 'Could not save note');
    } finally {
      setSavingNote(false);
    }
  };
  const markCaughtUp = async () => {
    setMarkingCaughtUp(true);
    setCatchUpError('');
    setCatchUpSuccess('');
    try {
      const response = await send({
        type: 'contexto:account:markCaughtUp',
        accountId: account.id,
      });
      if (response.ok && 'account' in response) {
        setAccount(response.account);
        setCatchUpSuccess('Catch-up checkpoint updated');
        return;
      }
      setCatchUpError(!response.ok ? response.error : 'Could not update catch-up checkpoint');
    } catch (error) {
      setCatchUpError(error instanceof Error ? error.message : 'Could not update catch-up checkpoint');
    } finally {
      setMarkingCaughtUp(false);
    }
  };

  const panel = open ? <section ref={panelRef} id={panelId} className="contexto-feed-panel" role="dialog" aria-label="Contexto relationship context" onClick={(event) => event.stopPropagation()}>
      <header className="contexto-feed-panel-header">
        <strong>Contexto</strong>
        <button type="button" aria-label="Close Contexto context" onClick={() => {
          setOpen(false);
          markerRef.current?.focus();
        }}>Close</button>
      </header>
      <section className="contexto-feed-section contexto-feed-summary" aria-labelledby={`${panelId}-saved`}>
        <span className="contexto-feed-section-label" id={`${panelId}-saved`}>Saved context</span>
        <strong>{account.displayName}</strong>
        {account.role?.trim() && <div className="contexto-metadata-field" data-testid="contexto-feed-role">
          <span className="contexto-metadata-label">Role:</span>
          <span className="contexto-metadata-value">{account.role}</span>
        </div>}
        {account.company?.name.trim() && <div className="contexto-metadata-field" data-testid="contexto-feed-company">
          <span className="contexto-metadata-label">Company:</span>
          <span className="contexto-metadata-value">{account.company.name}</span>
        </div>}
        {account.relationshipSource?.trim() && <div className="contexto-metadata-field" data-testid="contexto-feed-relationship">
          <span className="contexto-metadata-label">How you know them:</span>
          <span className="contexto-metadata-value">{account.relationshipSource}</span>
        </div>}
        {!editingGroupings && tags.length > 0 && <div className="contexto-metadata-field" data-testid="contexto-feed-tags">
          <span className="contexto-metadata-label">Tags:</span>
          <div className="contexto-feed-values contexto-metadata-value">
            {tags.map((tag) => <span className="chip" key={tag.id}>{tag.name}</span>)}
          </div>
        </div>}
        {!editingGroupings && folders.length > 0 && <div className="contexto-metadata-field" data-testid="contexto-feed-folders">
          <span className="contexto-metadata-label">Circles:</span>
          <div className="contexto-feed-values contexto-metadata-value">
            {folders.map((folder) => <span className="chip folder-chip" key={folder.id}>{folder.name}</span>)}
          </div>
        </div>}
        {account.latestNote?.body.trim() && <p className="contexto-metadata-field" data-testid="contexto-feed-note">
          <span className="contexto-metadata-label">Latest note:</span>
          <span className="contexto-metadata-value">{account.latestNote.body}</span>
        </p>}
        {editingGroupings ? <FeedGroupingsEditor account={account} send={send}
          onSaved={(updated) => {
            setAccount(updated);
            setEditingGroupings(false);
            setGroupingsSuccess('Tags and circles saved');
          }}
          onCancel={() => setEditingGroupings(false)}
        /> : <button type="button" onClick={() => {
          setGroupingsSuccess('');
          setEditingGroupings(true);
        }}>Edit tags and circles</button>}
        {groupingsSuccess && <p className="contexto-success" aria-live="polite">{groupingsSuccess}</p>}
      </section>
      <section className="contexto-feed-section contexto-feed-local-actions" aria-labelledby={`${panelId}-local`}>
        <span className="contexto-feed-section-label" id={`${panelId}-local`}>Add to Contexto</span>
        {!composerOpen && !noteComposerOpen && <div className="contexto-feed-action-row">
          <button type="button" onClick={openNoteComposer}>Add quick note</button>
          {bookmarkState === 'available' && <button type="button" onClick={openComposer}>Capture this post</button>}
          {bookmarkState === 'saved' && <button type="button" disabled>Bookmarked</button>}
        </div>}
        {noteComposerOpen && <div className="contexto-feed-note-composer">
          <label>
            Relationship note
            <textarea
              autoFocus
              rows={3}
              value={noteBody}
              disabled={savingNote}
              onChange={(event) => setNoteBody(event.target.value)}
            />
          </label>
          {noteError && <p className="contexto-error" role="alert">{noteError}</p>}
          <div className="contexto-feed-note-actions">
            <button className="primary-action" type="button" disabled={savingNote || !noteBody.trim()} onClick={saveQuickNote}>
              {savingNote ? 'Saving note…' : 'Save note'}
            </button>
            <button type="button" disabled={savingNote} onClick={cancelNoteComposer}>Cancel</button>
          </div>
        </div>}
        {noteSuccess && <p className="contexto-success" aria-live="polite">{noteSuccess}</p>}
        {composerOpen && <div className="contexto-feed-bookmark-composer">
          <label>
            Why are you saving this? (optional)
            <textarea
              autoFocus
              rows={3}
              value={reminder}
              disabled={saving}
              onChange={(event) => setReminder([...event.target.value].slice(0, 500).join(''))}
            />
          </label>
          {bookmarkError && <p className="contexto-error" role="alert">{bookmarkError}</p>}
          <div className="contexto-feed-bookmark-actions">
            <button className="primary-action" type="button" disabled={saving} onClick={saveBookmark}>
              {saving ? 'Saving…' : 'Save bookmark'}
            </button>
            <button type="button" disabled={saving} onClick={cancelComposer}>Cancel</button>
          </div>
        </div>}
        {bookmarkSuccess && <p className="contexto-success" aria-live="polite">{bookmarkSuccess}</p>}
      </section>
      <section className="contexto-feed-section contexto-feed-x-actions" role="group" aria-labelledby={`${panelId}-x`}>
        <span className="contexto-feed-section-label" id={`${panelId}-x`}>Explore on X</span>
        <div className="contexto-feed-x-links">
          {catchUpUrl && <a
            aria-label="Catch up on X"
            className="contexto-feed-x-link"
            href={catchUpUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              Catch up on X
              <small>Review recent posts</small>
            </span>
            <span aria-hidden="true">↗</span>
          </a>}
          {interactionUrl && <a
            aria-label="View our interactions"
            className="contexto-feed-x-link"
            href={interactionUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              View our interactions
              <small>Search your shared conversation</small>
            </span>
            <span aria-hidden="true">↗</span>
          </a>}
        </div>
        {catchUpUrl && <div className="contexto-feed-checkpoint" data-testid="contexto-feed-checkpoint">
          <div>
            {account.lastCatchUpAt
              ? <time dateTime={account.lastCatchUpAt}>
                Last caught up {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(account.lastCatchUpAt))}
              </time>
              : <span>No catch-up checkpoint yet</span>}
          </div>
          <button type="button" disabled={markingCaughtUp} onClick={markCaughtUp}>
            {markingCaughtUp ? 'Updating…' : 'Mark caught up'}
          </button>
        </div>}
        {catchUpError && <p className="contexto-error" role="alert">{catchUpError}</p>}
        {catchUpSuccess && <p className="contexto-success" aria-live="polite">{catchUpSuccess}</p>}
      </section>
      <footer className="contexto-feed-section contexto-feed-footer">
        <button className="primary-action" type="button" onClick={openEditor}>Open full context</button>
      </footer>
    </section> : null;

  return <span className="contexto-feed-context">
    <button
      ref={markerRef}
      className="contexto-feed-marker"
      type="button"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={open && !panelContainer ? panelId : undefined}
      aria-label={`Contexto context for ${account.displayName}`}
      onClick={togglePanel}
    >◆ Contexto</button>
    {panelContainer ? createPortal(panel, panelContainer) : panel}
  </span>;
}

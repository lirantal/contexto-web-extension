import React, { useEffect, useRef, useState } from 'react';
import type { AccountSummary, ProfileSnapshot, XPostSnapshot } from '@/src/shared/types';
import type { ContextoProfileSurfaceProps } from './ContextoProfileSurface';

export interface ContextoFeedContextProps {
  profile: ProfileSnapshot;
  post?: XPostSnapshot;
  send: ContextoProfileSurfaceProps['send'];
  onEdit(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void;
}

type BookmarkState = 'unavailable' | 'loading' | 'available' | 'saved';

export function ContextoFeedContext({ profile, post, send, onEdit }: ContextoFeedContextProps) {
  const [account, setAccount] = useState<AccountSummary>();
  const [open, setOpen] = useState(false);
  const [bookmarkState, setBookmarkState] = useState<BookmarkState>('unavailable');
  const [composerOpen, setComposerOpen] = useState(false);
  const [reminder, setReminder] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookmarkError, setBookmarkError] = useState('');
  const [bookmarkSuccess, setBookmarkSuccess] = useState('');
  const markerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setAccount(undefined);
    setOpen(false);
    setBookmarkState(post ? 'loading' : 'unavailable');
    setComposerOpen(false);
    setReminder('');
    setBookmarkError('');
    setBookmarkSuccess('');
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
    setComposerOpen(false);
    setReminder('');
    setBookmarkError('');
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
  const organization = [account.role, account.company?.name].filter(Boolean).join(' · ');
  const openEditor = () => {
    if (markerRef.current) onEdit(profile, markerRef.current);
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

  return <span className="contexto-feed-context">
    <button
      ref={markerRef}
      className="contexto-feed-marker"
      type="button"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      aria-label={`Contexto context for ${account.displayName}`}
      onClick={() => setOpen((current) => !current)}
    >◆ Contexto</button>
    {open && <section ref={panelRef} id={panelId} className="contexto-feed-panel" role="dialog" aria-label="Contexto relationship context">
      <header className="contexto-feed-panel-header"><strong>{account.displayName}</strong><span>Saved context</span></header>
      {organization && <span data-testid="contexto-feed-organization">{organization}</span>}
      {account.relationshipSource && <span data-testid="contexto-feed-relationship">{account.relationshipSource}</span>}
      {account.tags.length > 0 && <div className="contexto-feed-values" data-testid="contexto-feed-tags">{account.tags.map((tag) => <span className="chip" key={tag.id}>{tag.name}</span>)}</div>}
      {account.folders.length > 0 && <div className="contexto-feed-values" data-testid="contexto-feed-folders">{account.folders.map((folder) => <span className="chip folder-chip" key={folder.id}>{folder.name}</span>)}</div>}
      {account.latestNote && <p data-testid="contexto-feed-note">{account.latestNote.body}</p>}
      {bookmarkState === 'available' && !composerOpen && <button type="button" onClick={openComposer}>Capture this post</button>}
      {bookmarkState === 'saved' && <button type="button" disabled>Bookmarked</button>}
      {composerOpen && <div className="contexto-feed-bookmark-composer">
        <label>
          Why are you saving this? (optional)
          <textarea
            autoFocus
            rows={3}
            maxLength={500}
            value={reminder}
            disabled={saving}
            onChange={(event) => setReminder(event.target.value)}
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
      <button className="primary-action" type="button" onClick={openEditor}>Open full context</button>
    </section>}
  </span>;
}

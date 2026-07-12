import React, { useEffect, useRef, useState } from 'react';
import type { AccountSummary, ProfileSnapshot } from '@/src/shared/types';
import type { ContextoProfileSurfaceProps } from './ContextoProfileSurface';

export interface ContextoFeedContextProps {
  profile: ProfileSnapshot;
  send: ContextoProfileSurfaceProps['send'];
  onEdit(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void;
}

export function ContextoFeedContext({ profile, send, onEdit }: ContextoFeedContextProps) {
  const [account, setAccount] = useState<AccountSummary>();
  const [open, setOpen] = useState(false);
  const markerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setAccount(undefined);
    setOpen(false);
    send({ type: 'contexto:account:lookup', platform: 'x', handle: profile.handle })
      .then((response) => {
        if (cancelled || !response.ok || !('lookup' in response)) return;
        setAccount(response.lookupAccount);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [profile.handle, send]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnPointerOutside = (event: PointerEvent) => {
      const path = event.composedPath();
      if (!path.includes(markerRef.current) && !path.includes(panelRef.current)) setOpen(false);
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
      <button className="primary-action" type="button" onClick={openEditor}>Open full context</button>
    </section>}
  </span>;
}

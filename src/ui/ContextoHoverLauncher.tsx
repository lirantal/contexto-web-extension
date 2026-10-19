import React, { useEffect, useRef, useState } from 'react';
import type { AccountSummary, ProfileSnapshot } from '@/src/shared/types';
import type { ContextoProfileSurfaceProps } from './ContextoProfileSurface';

export interface ContextoHoverLauncherProps {
  profile: ProfileSnapshot;
  send: ContextoProfileSurfaceProps['send'];
  onEdit(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void;
}

export function ContextoHoverLauncher({ profile, send, onEdit }: ContextoHoverLauncherProps) {
  const [state, setState] = useState<'loading' | 'saved' | 'unsaved' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [account, setAccount] = useState<AccountSummary>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerActivatedRef = useRef(false);

  useEffect(() => {
    let active = true;
    setState('loading');
    send({ type: 'contexto:account:lookup', platform: 'x', handle: profile.handle })
      .then((response) => {
        if (!active) return;
        if (!response.ok || !('lookup' in response)) {
          setState('error');
          return;
        }
        setAccount(response.lookupAccount);
        setState(response.lookupAccount ? 'saved' : 'unsaved');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => { active = false; };
  }, [attempt, profile.handle, send]);

  function openEditor() {
    if (buttonRef.current) onEdit(profile, buttonRef.current);
  }

  function handlePointerDown() {
    pointerActivatedRef.current = true;
    openEditor();
  }

  function handleClick() {
    if (pointerActivatedRef.current) {
      pointerActivatedRef.current = false;
      return;
    }
    openEditor();
  }

  const tags = account?.tags.filter((tag) => tag.name.trim()) ?? [];

  if (state === 'error') {
    return <section className="contexto-hover-launcher" aria-label="Contexto profile context">
      <div className="contexto-hover-header">
        <strong>◆ Contexto</strong>
        <span>Contexto unavailable</span>
        <button type="button" onClick={() => setAttempt((current) => current + 1)}>Retry</button>
      </div>
    </section>;
  }

  return <section className="contexto-hover-launcher" aria-label="Contexto profile context">
    <div className="contexto-hover-header">
      <strong>◆ Contexto</strong>
      <span>{state === 'loading' ? 'Loading…' : state === 'saved' ? 'Saved' : 'Not saved'}</span>
      <button
        ref={buttonRef}
        type="button"
        disabled={state === 'loading'}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >Edit</button>
    </div>
    {account && <div className="contexto-hover-summary">
      <strong className="contexto-hover-name">{account.displayName}</strong>
      {account.role?.trim() && <div className="contexto-metadata-field" data-testid="contexto-hover-role">
        <span className="contexto-metadata-label">Role:</span>
        <span className="contexto-metadata-value">{account.role}</span>
      </div>}
      {account.company?.name.trim() && <div className="contexto-metadata-field" data-testid="contexto-hover-company">
        <span className="contexto-metadata-label">Company:</span>
        <span className="contexto-metadata-value">{account.company.name}</span>
      </div>}
      {tags.length > 0 && <div className="contexto-metadata-field" data-testid="contexto-hover-tags">
        <span className="contexto-metadata-label">Tags:</span>
        <div className="contexto-hover-tags contexto-metadata-value">
          {tags.map((tag) => <span className="contexto-hover-tag" key={tag.id}>{tag.name}</span>)}
        </div>
      </div>}
    </div>}
  </section>;
}

import React, { useEffect, useRef, useState } from 'react';
import type { ProfileSnapshot } from '@/src/shared/types';
import type { ContextoProfileSurfaceProps } from './ContextoProfileSurface';

export interface ContextoHoverLauncherProps {
  profile: ProfileSnapshot;
  send: ContextoProfileSurfaceProps['send'];
  onEdit(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void;
}

export function ContextoHoverLauncher({ profile, send, onEdit }: ContextoHoverLauncherProps) {
  const [state, setState] = useState<'loading' | 'saved' | 'unsaved' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        setState(response.lookupAccount ? 'saved' : 'unsaved');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => { active = false; };
  }, [attempt, profile.handle, send]);

  if (state === 'error') {
    return <section className="contexto-hover-launcher" aria-label="Contexto profile context">
      <strong>◆ Contexto</strong>
      <span>Contexto unavailable</span>
      <button type="button" onClick={() => setAttempt((current) => current + 1)}>Retry</button>
    </section>;
  }

  return <section className="contexto-hover-launcher" aria-label="Contexto profile context">
    <strong>◆ Contexto</strong>
    <span>{state === 'loading' ? 'Loading…' : state === 'saved' ? 'Saved' : 'Not saved'}</span>
    <button
      ref={buttonRef}
      type="button"
      disabled={state === 'loading'}
      onClick={() => buttonRef.current && onEdit(profile, buttonRef.current)}
    >Edit</button>
  </section>;
}

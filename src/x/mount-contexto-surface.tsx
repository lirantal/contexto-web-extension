import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ContextoProfileSurface, type ContextoProfileSurfaceProps } from '@/src/ui/ContextoProfileSurface';
import type { AccountDraftStore } from './draft-store';
import { ContextoHoverLauncher } from '@/src/ui/ContextoHoverLauncher';
import type { ProfileSnapshot } from '@/src/shared/types';
import type { ObservedXSurface } from './surface-observer';

export interface MountContextoSurfaceOptions {
  surface: ObservedXSurface;
  send: ContextoProfileSurfaceProps['send'];
  drafts: AccountDraftStore;
  css: string;
  theme: 'light' | 'dark';
  openPageEditor?(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void;
}

export function detectXTheme(host: HTMLElement): 'light' | 'dark' {
  for (let node: HTMLElement | null = host; node; node = node.parentElement) {
    const channels = getComputedStyle(node).backgroundColor.match(/\d+(?:\.\d+)?/g)?.map(Number);
    if (!channels || channels.length < 3 || (channels.length > 3 && channels[3] === 0)) continue;
    return (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000 < 128 ? 'dark' : 'light';
  }
  return 'light';
}

export function mountContextoSurface({ surface, send, drafts, css, theme, openPageEditor = () => undefined }: MountContextoSurfaceOptions): () => void {
  const previousHostPosition = surface.host.style.position;
  const hostPosition = getComputedStyle(surface.host).position;
  const positionHoverHost = surface.kind === 'hover-card' && (!hostPosition || hostPosition === 'static');
  if (positionHoverHost) surface.host.style.position = 'relative';
  const mountHost = document.createElement('div');
  mountHost.dataset.contextoSurface = surface.kind;
  mountHost.dataset.theme = theme;
  const shadow = mountHost.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const app = document.createElement('div');
  shadow.append(style, app);
  surface.host.append(mountHost);
  const root = createRoot(app);
  flushSync(() => {
    root.render(surface.kind === 'hover-card'
      ? <ContextoHoverLauncher profile={surface.profile} send={send} onEdit={openPageEditor} />
      : <ContextoProfileSurface profile={surface.profile} kind={surface.kind} send={send} drafts={drafts} />
    );
  });
  return () => {
    root.unmount();
    mountHost.remove();
    if (positionHoverHost) surface.host.style.position = previousHostPosition;
  };
}

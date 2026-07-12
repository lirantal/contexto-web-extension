import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ContextoProfileSurface, type ContextoProfileSurfaceProps } from '@/src/ui/ContextoProfileSurface';
import type { AccountDraftStore } from './draft-store';
import { ContextoHoverLauncher } from '@/src/ui/ContextoHoverLauncher';
import { ContextoFeedContext } from '@/src/ui/ContextoFeedContext';
import type { ProfileSnapshot } from '@/src/shared/types';
import type { ObservedXSurface, XSurfaceCleanup } from './surface-observer';
import { resolveHoverCardInsertion } from './hover-card-placement';
import { resolveFeedPostInsertion } from './feed-post-placement';

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

export function mountContextoSurface({ surface, send, drafts, css, theme, openPageEditor = () => undefined }: MountContextoSurfaceOptions): XSurfaceCleanup {
  const mountHost = document.createElement('div');
  mountHost.dataset.contextoSurface = surface.kind;
  mountHost.dataset.theme = theme;
  const shadow = mountHost.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const app = document.createElement('div');
  shadow.append(style, app);
  if (surface.kind === 'hover-card') {
    const { parent, before } = resolveHoverCardInsertion(surface.host, surface.profile.handle);
    parent.insertBefore(mountHost, before);
  } else if (surface.kind === 'feed-post') {
    const insertion = resolveFeedPostInsertion(surface.host, surface.profile.handle);
    if (!insertion) {
      const cleanup = (() => undefined) as XSurfaceCleanup;
      cleanup.isConnected = () => false;
      return cleanup;
    }
    insertion.parent.insertBefore(mountHost, insertion.before);
  } else {
    surface.host.append(mountHost);
  }
  const root = createRoot(app);
  flushSync(() => {
    root.render(surface.kind === 'hover-card'
      ? <ContextoHoverLauncher profile={surface.profile} send={send} onEdit={openPageEditor} />
      : surface.kind === 'feed-post'
        ? <ContextoFeedContext profile={surface.profile} send={send} onEdit={openPageEditor} />
        : <ContextoProfileSurface profile={surface.profile} kind={surface.kind} send={send} drafts={drafts} />
    );
  });
  const cleanup: XSurfaceCleanup = () => {
    root.unmount();
    mountHost.remove();
  };
  cleanup.isConnected = () => mountHost.isConnected && surface.host.contains(mountHost);
  return cleanup;
}

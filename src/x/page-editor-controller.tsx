import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { ProfileSnapshot } from '@/src/shared/types';
import { ContextoProfileSurface, type ContextoProfileSurfaceProps } from '@/src/ui/ContextoProfileSurface';
import type { AccountDraftStore } from './draft-store';
import { detectXTheme } from './mount-contexto-surface';

export interface PageEditorControllerOptions {
  root: HTMLElement;
  send: ContextoProfileSurfaceProps['send'];
  drafts: AccountDraftStore;
  css: string;
}

export interface PageEditorController {
  open(profile: ProfileSnapshot, returnFocusTarget: HTMLElement): void;
  close(): void;
  disconnect(): void;
}

export function createPageEditorController({ root, send, drafts, css }: PageEditorControllerOptions): PageEditorController {
  let host: HTMLDivElement | undefined;
  let app: HTMLDivElement | undefined;
  let reactRoot: Root | undefined;
  let shadow: ShadowRoot | undefined;
  let editorObserver: MutationObserver | undefined;
  let activeProfile: ProfileSnapshot | undefined;
  let focusTarget: HTMLElement | undefined;
  let placement: 'docked' | 'modal' = 'modal';
  let needsModalFocus = false;
  const wideViewport = root.ownerDocument.defaultView?.matchMedia?.('(min-width: 1100px)');

  function focusModalControl() {
    if (placement !== 'modal' || !needsModalFocus) return;
    const target = shadow?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])');
    if (!target) return;
    target.focus();
    needsModalFocus = false;
  }

  function requestClose() {
    if (activeProfile && drafts.get(activeProfile.handle)) return;
    close();
  }

  function handleModalKeydown(event: KeyboardEvent) {
    if (placement !== 'modal') return;
    if (event.key !== 'Tab' || !shadow) return;
    const focusable = Array.from(shadow.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.hasAttribute('disabled'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && shadow.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && shadow.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function ensureHost() {
    if (host) return;
    host = document.createElement('div');
    host.dataset.contextoPageEditor = '';
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = css;
    app = document.createElement('div');
    shadow.append(style, app);
    shadow.addEventListener('keydown', (event) => handleModalKeydown(event as KeyboardEvent));
    editorObserver = new MutationObserver(focusModalControl);
    editorObserver.observe(app, { childList: true, subtree: true });
    reactRoot = createRoot(app);
  }

  function renderEditor() {
    if (!activeProfile || !reactRoot) return;
    flushSync(() => {
      reactRoot?.render(
        <ContextoProfileSurface
          key={activeProfile!.handle.replace(/^@/, '').toLowerCase()}
          profile={activeProfile!}
          kind="hover-card"
          send={send}
          drafts={drafts}
          placement={placement}
          onRequestClose={requestClose}
        />,
      );
    });
  }

  function place() {
    if (!host || !activeProfile) return;
    const nextPlacement = wideViewport?.matches ? 'docked' : 'modal';
    if (host.parentElement !== root) root.append(host);
    host.dataset.placement = nextPlacement;
    host.dataset.theme = detectXTheme(root);
    if (placement !== nextPlacement) {
      placement = nextPlacement;
      needsModalFocus = nextPlacement === 'modal';
      renderEditor();
    }
    focusModalControl();
  }

  wideViewport?.addEventListener('change', place);

  function open(profile: ProfileSnapshot, returnFocusTarget: HTMLElement) {
    if (activeProfile && activeProfile.handle.toLowerCase() !== profile.handle.toLowerCase() && drafts.get(activeProfile.handle)) return;
    activeProfile = profile;
    focusTarget = returnFocusTarget;
    ensureHost();
    placement = wideViewport?.matches ? 'docked' : 'modal';
    needsModalFocus = placement === 'modal';
    root.append(host!);
    host!.dataset.placement = placement;
    host!.dataset.theme = detectXTheme(root);
    renderEditor();
    focusModalControl();
  }

  function close() {
    editorObserver?.disconnect();
    editorObserver = undefined;
    needsModalFocus = false;
    reactRoot?.unmount();
    host?.remove();
    reactRoot = undefined;
    shadow = undefined;
    app = undefined;
    host = undefined;
    activeProfile = undefined;
    const target = focusTarget;
    focusTarget = undefined;
    if (target?.isConnected) target.focus();
  }

  return {
    open,
    close,
    disconnect() {
      wideViewport?.removeEventListener('change', place);
      close();
    },
  };
}

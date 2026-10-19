import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ContextoSidebarWorkspace } from '@/src/ui/ContextoSidebarWorkspace';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { XSurfaceCleanup } from './surface-observer';
import { resolveXSidebarSearchPlacement } from './sidebar-search-placement';

export interface MountContextoSidebarSearchOptions {
  nativeForm: HTMLFormElement;
  send: (message: ContextoRequest) => Promise<ContextoResponse>;
  css: string;
  theme: 'light' | 'dark';
}

export function mountContextoSidebarSearch({
  nativeForm,
  send,
  css,
  theme,
}: MountContextoSidebarSearchOptions): XSurfaceCleanup {
  const placement = resolveXSidebarSearchPlacement(nativeForm);
  if (!placement) {
    const cleanup: XSurfaceCleanup = () => {};
    cleanup.isConnected = () => false;
    return cleanup;
  }
  const { sidebarColumn, nativeBranch } = placement;
  const mountHost = document.createElement('div');
  mountHost.dataset.contextoSurface = 'sidebar-search';
  mountHost.dataset.theme = theme;
  const shadow = mountHost.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = css;
  const app = document.createElement('div');
  shadow.append(style, app);
  nativeBranch.before(mountHost);

  const root = createRoot(app);
  flushSync(() => {
    root.render(<ContextoSidebarWorkspace send={send} />);
  });

  const cleanup: XSurfaceCleanup = () => {
    root.unmount();
    mountHost.remove();
  };
  cleanup.isConnected = () => {
    const current = resolveXSidebarSearchPlacement(nativeForm);
    return mountHost.isConnected
      && nativeForm.isConnected
      && current?.sidebarColumn === sidebarColumn
      && current.nativeBranch === nativeBranch
      && mountHost.parentElement === sidebarColumn
      && mountHost.nextElementSibling === nativeBranch;
  };
  return cleanup;
}

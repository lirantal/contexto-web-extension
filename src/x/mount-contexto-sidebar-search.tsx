import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ContextoSidebarWorkspace } from '@/src/ui/ContextoSidebarWorkspace';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import type { XSurfaceCleanup } from './surface-observer';

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
  const mountHost = document.createElement('div');
  mountHost.dataset.contextoSurface = 'sidebar-search';
  mountHost.dataset.theme = theme;
  const shadow = mountHost.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = css;
  const app = document.createElement('div');
  shadow.append(style, app);
  nativeForm.before(mountHost);

  const root = createRoot(app);
  flushSync(() => {
    root.render(<ContextoSidebarWorkspace send={send} />);
  });

  const cleanup: XSurfaceCleanup = () => {
    root.unmount();
    mountHost.remove();
  };
  cleanup.isConnected = () => (
    mountHost.isConnected
    && nativeForm.isConnected
    && mountHost.parentElement === nativeForm.parentElement
    && mountHost.nextElementSibling === nativeForm
  );
  return cleanup;
}

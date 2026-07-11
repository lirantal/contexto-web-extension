import surfaceCss from '@/src/ui/contexto-profile-surface.css?inline';
import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';
import { AccountDraftStore } from '@/src/x/draft-store';
import { mountContextoSurface, detectXTheme } from '@/src/x/mount-contexto-surface';
import { createXSurfaceObserver } from '@/src/x/surface-observer';

const drafts = new AccountDraftStore();
const send = (message: ContextoRequest): Promise<ContextoResponse> => browser.runtime.sendMessage(message);

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    const observer = createXSurfaceObserver({
      root: document.body,
      currentUrl: () => location.href,
      onPageContextChange: () => drafts.clearAll(),
      mount: (surface) => mountContextoSurface({
        surface,
        send,
        drafts,
        css: surfaceCss,
        theme: detectXTheme(surface.host),
      }),
    });
    ctx.onInvalidated(() => {
      observer.disconnect();
      drafts.clearAll();
    });
  },
});

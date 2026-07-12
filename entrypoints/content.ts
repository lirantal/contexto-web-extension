import surfaceCss from '@/src/ui/contexto-profile-surface.css?inline';
import { createContentRuntimeSender } from '@/src/x/content-runtime-sender';
import { AccountDraftStore } from '@/src/x/draft-store';
import { mountContextoSurface, detectXTheme } from '@/src/x/mount-contexto-surface';
import { createXSurfaceObserver } from '@/src/x/surface-observer';
import { createPageEditorController } from '@/src/x/page-editor-controller';

const drafts = new AccountDraftStore();

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  cssInjectionMode: 'ui',
  main(ctx) {
    const send = createContentRuntimeSender(
      ctx,
      (message) => browser.runtime.sendMessage(message),
    );
    const pageEditor = createPageEditorController({
      root: document.body,
      send,
      drafts,
      css: surfaceCss,
    });
    const observer = createXSurfaceObserver({
      root: document.body,
      currentUrl: () => location.href,
      onPageContextChange: () => {
        pageEditor.close();
        drafts.clearAll();
      },
      mount: (surface) => mountContextoSurface({
        surface,
        send,
        drafts,
        css: surfaceCss,
        theme: detectXTheme(surface.host),
        openPageEditor: pageEditor.open,
      }),
    });
    ctx.onInvalidated(() => {
      observer.disconnect();
      pageEditor.disconnect();
      drafts.clearAll();
    });
  },
});

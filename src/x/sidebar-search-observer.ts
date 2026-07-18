import type { XSurfaceCleanup } from './surface-observer';

export function createXSidebarSearchObserver({
  root,
  mount,
}: {
  root: HTMLElement;
  mount: (nativeForm: HTMLFormElement) => XSurfaceCleanup;
}) {
  let cleanup: XSurfaceCleanup | undefined;
  let mountedForm: HTMLFormElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scan = () => {
    timer = undefined;
    const input = root.querySelector<HTMLInputElement>('input[data-testid="SearchBox_Search_Input"]');
    const form = input?.closest<HTMLFormElement>('form') ?? undefined;
    if (form === mountedForm && (cleanup?.isConnected?.() ?? Boolean(cleanup))) return;
    cleanup?.();
    cleanup = undefined;
    mountedForm = form;
    if (form) cleanup = mount(form);
  };

  const queue = () => {
    if (timer === undefined) timer = setTimeout(scan, 100);
  };

  const observer = new MutationObserver(queue);
  observer.observe(root, { childList: true, subtree: true });
  queue();

  return {
    disconnect() {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
      cleanup?.();
      cleanup = undefined;
      mountedForm = undefined;
    },
  };
}

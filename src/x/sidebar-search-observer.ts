import type { XSurfaceCleanup } from './surface-observer';
import { resolveXSidebarSearchPlacement } from './sidebar-search-placement';

const nativeWidgetMarker = 'data-contexto-native-sidebar-widget';

interface NativeWidgetState {
  display: string;
  marginTop: string;
  marker: string | null;
}

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
  let showNativeWidgets = false;
  let nativeWidgets: HTMLElement[] = [];
  const nativeWidgetStates = new Map<HTMLElement, NativeWidgetState>();

  const restoreNativeWidget = (widget: HTMLElement, state: NativeWidgetState) => {
    widget.style.display = state.display;
    widget.style.marginTop = state.marginTop;
    if (state.marker === null) widget.removeAttribute(nativeWidgetMarker);
    else widget.setAttribute(nativeWidgetMarker, state.marker);
  };

  const applyNativeWidgetPolicy = () => {
    nativeWidgets.forEach((widget, index) => {
      const original = nativeWidgetStates.get(widget);
      if (!original) return;
      widget.style.display = showNativeWidgets ? original.display : 'none';
      widget.style.marginTop = showNativeWidgets && index === 0
        ? '50vh'
        : original.marginTop;
    });
  };

  const syncNativeWidgets = (nextWidgets: HTMLElement[]) => {
    const nextWidgetSet = new Set(nextWidgets);
    nativeWidgetStates.forEach((state, widget) => {
      if (nextWidgetSet.has(widget)) return;
      restoreNativeWidget(widget, state);
      nativeWidgetStates.delete(widget);
    });

    nextWidgets.forEach((widget) => {
      if (nativeWidgetStates.has(widget)) return;
      nativeWidgetStates.set(widget, {
        display: widget.style.display,
        marginTop: widget.style.marginTop,
        marker: widget.getAttribute(nativeWidgetMarker),
      });
      widget.setAttribute(nativeWidgetMarker, '');
    });
    nativeWidgets = nextWidgets;
    applyNativeWidgetPolicy();
  };

  const resolveNativeWidgets = (form: HTMLFormElement): HTMLElement[] => {
    const sidebarColumn = form.closest<HTMLElement>('[data-testid="sidebarColumn"]');
    if (!sidebarColumn || !root.contains(sidebarColumn)) return [];

    let current: HTMLElement = form;
    let widgets: HTMLElement[] = [];
    while (current.parentElement) {
      const parent = current.parentElement;
      if (parent !== sidebarColumn && !sidebarColumn.contains(parent)) return [];
      const siblings = Array.from(parent.children);
      const currentIndex = siblings.indexOf(current);
      const followingSiblings = siblings.slice(currentIndex + 1)
        .filter((element): element is HTMLElement => element instanceof HTMLElement);
      if (followingSiblings.length > 0) widgets = followingSiblings;
      if (parent === sidebarColumn) break;
      current = parent;
    }
    return widgets;
  };

  const scan = () => {
    timer = undefined;
    const form = Array.from(root.querySelectorAll<HTMLInputElement>('input[data-testid="SearchBox_Search_Input"]'))
      .map((input) => input.closest<HTMLFormElement>('form'))
      .find((candidate): candidate is HTMLFormElement => {
        if (!candidate) return false;
        const placement = resolveXSidebarSearchPlacement(candidate);
        return Boolean(placement && root.contains(placement.sidebarColumn));
      });
    const mountIsConnected = cleanup?.isConnected?.() ?? Boolean(cleanup);
    if (form !== mountedForm || !mountIsConnected) {
      cleanup?.();
      cleanup = undefined;
      mountedForm = form;
      if (form) cleanup = mount(form);
    }
    syncNativeWidgets(form ? resolveNativeWidgets(form) : []);
  };

  const queue = () => {
    if (timer === undefined) timer = setTimeout(scan, 100);
  };

  const observer = new MutationObserver(queue);
  observer.observe(root, { childList: true, subtree: true });
  queue();

  return {
    setShowNativeWidgets(show: boolean) {
      showNativeWidgets = show;
      applyNativeWidgetPolicy();
    },
    disconnect() {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
      cleanup?.();
      cleanup = undefined;
      mountedForm = undefined;
      syncNativeWidgets([]);
    },
  };
}

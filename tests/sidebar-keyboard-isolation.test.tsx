import React from 'react';
import { readFileSync } from 'node:fs';
import { act } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { mountContextoSidebarSearch } from '@/src/x/mount-contexto-sidebar-search';

const handlers = vi.hoisted(() => ({ keydown: vi.fn(), keypress: vi.fn(), keyup: vi.fn() }));
vi.mock('@/src/ui/ContextoSidebarWorkspace', () => ({
  ContextoSidebarWorkspace: () => <input onKeyDown={handlers.keydown} onKeyPress={handlers.keypress} onKeyUp={handlers.keyup} />,
}));

it('keeps composed keyboard events inside the workspace after React handles them and preserves defaults', () => {
  document.body.innerHTML = readFileSync('tests/fixtures/x/sidebar-native-search.html', 'utf8');
  let shadow: ShadowRoot;
  const attachShadow = Element.prototype.attachShadow;
  const spy = vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, options) {
    shadow = attachShadow.call(this, options);
    return shadow;
  });
  const pageShortcut = vi.fn();
  for (const type of ['keydown', 'keypress', 'keyup']) document.addEventListener(type, pageShortcut);
  let cleanup!: ReturnType<typeof mountContextoSidebarSearch>;
  act(() => { cleanup = mountContextoSidebarSearch({
    nativeForm: document.querySelector('form')!,
    send: vi.fn(), css: '', theme: 'light',
  }); });
  try {
    const input = shadow!.querySelector('input')!;
    for (const key of ['g', 'n', '/', 'ArrowDown', 'Enter', 'Tab', 'Escape']) {
      for (const type of ['keydown', 'keypress', 'keyup'] as const) {
        const event = new KeyboardEvent(type, { key, charCode: key.charCodeAt(0), bubbles: true, composed: true, cancelable: true });
        act(() => input.dispatchEvent(event));
        expect(handlers[type]).toHaveBeenCalled();
        handlers[type].mockClear();
        expect(event.defaultPrevented).toBe(false);
      }
    }
    expect(pageShortcut).not.toHaveBeenCalled();
    const nativeInput = document.querySelector('input')!;
    nativeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true, composed: true }));
    expect(pageShortcut).toHaveBeenCalledOnce();
  } finally {
    act(() => cleanup());
    spy.mockRestore();
    for (const type of ['keydown', 'keypress', 'keyup']) document.removeEventListener(type, pageShortcut);
  }
});

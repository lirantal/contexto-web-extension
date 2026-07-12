import { describe, expect, it, vi } from 'vitest';
import { createContentRuntimeSender } from '@/src/x/content-runtime-sender';

const request = { type: 'contexto:settings:get' } as const;

describe('createContentRuntimeSender', () => {
  it('sends through a valid content-script context', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, settings: { myXHandle: '', lastDashboardView: 'accounts' } });
    const send = createContentRuntimeSender({ isValid: true }, sendMessage);

    await expect(send(request)).resolves.toMatchObject({ ok: true });
    expect(sendMessage).toHaveBeenCalledWith(request);
  });

  it('rejects without messaging when the WXT context is invalid', async () => {
    const sendMessage = vi.fn();
    const send = createContentRuntimeSender({ isValid: false }, sendMessage);

    await expect(send(request)).rejects.toThrow('Extension context invalidated. Reload this X tab.');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('converts a synchronous runtime throw into a rejected promise', async () => {
    const sendMessage = vi.fn(() => { throw new Error('Extension context invalidated.'); });
    const send = createContentRuntimeSender({ isValid: true }, sendMessage);

    await expect(send(request)).rejects.toThrow('Extension context invalidated.');
  });
});

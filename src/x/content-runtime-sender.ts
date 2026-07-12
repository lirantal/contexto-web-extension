import type { ContextoRequest, ContextoResponse } from '@/src/shared/messages';

export interface ContentRuntimeContext {
  readonly isValid: boolean;
}

export type RuntimeSendMessage = (message: ContextoRequest) => ContextoResponse | Promise<ContextoResponse>;

export function createContentRuntimeSender(
  context: ContentRuntimeContext,
  sendMessage: RuntimeSendMessage,
): (message: ContextoRequest) => Promise<ContextoResponse> {
  return (message) => {
    if (!context.isValid) {
      return Promise.reject(new Error('Extension context invalidated. Reload this X tab.'));
    }
    try {
      return Promise.resolve(sendMessage(message));
    } catch (error) {
      return Promise.reject(error);
    }
  };
}

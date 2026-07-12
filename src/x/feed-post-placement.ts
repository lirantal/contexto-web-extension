import { normalizeXHandle } from '@/src/shared/platforms/x';
import { findFeedPostIdentity } from './feed-post-extraction';

export interface FeedPostInsertion {
  parent: HTMLElement;
  before: ChildNode | null;
}

export function resolveFeedPostInsertion(post: HTMLElement, handle: string): FeedPostInsertion | null {
  const identity = findFeedPostIdentity(post);
  if (!identity || identity.handle !== normalizeXHandle(handle)) return null;
  return { parent: identity.container, before: null };
}

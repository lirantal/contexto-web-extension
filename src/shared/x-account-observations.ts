import type { XAccountObservations } from './types';
import { normalizeXHandle, isValidXHandle } from './platforms/x';

export function validateXAccountObservations(value: XAccountObservations): void {
  for (const count of [value.followersCount, value.followingCount]) {
    if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) throw new Error('Audience counts must be nonnegative safe integers');
  }
  for (const timestamp of [value.followersCountObservedAt, value.followingCountObservedAt, value.followsYouObservedAt]) {
    if (timestamp !== undefined && (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp)))) throw new Error('Invalid X observation timestamp');
  }
  if (value.followsYou !== undefined && (typeof value.followsYou !== 'boolean'
    || typeof value.followsYouViewerHandle !== 'string' || !isValidXHandle(value.followsYouViewerHandle)
    || normalizeXHandle(value.followsYouViewerHandle) !== value.followsYouViewerHandle)) {
    throw new Error('Follows-you observations require a boolean and normalized viewer handle');
  }
  if (value.followsYouViewerHandle !== undefined && (typeof value.followsYouViewerHandle !== 'string'
    || !isValidXHandle(value.followsYouViewerHandle) || normalizeXHandle(value.followsYouViewerHandle) !== value.followsYouViewerHandle)) {
    throw new Error('Invalid follows-you viewer handle');
  }
  if (value.followsYouViewerId !== undefined && (typeof value.followsYouViewerId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value.followsYouViewerId))) throw new Error('Invalid follows-you viewer ID');
}

/** Missing evidence preserves saved observations. Older snapshots cannot replace newer ones. */
export function observationPatch(incoming: XAccountObservations, current: XAccountObservations = {}): XAccountObservations {
  validateXAccountObservations(incoming);
  const patch: XAccountObservations = {};
  for (const [field, date] of [['followersCount', 'followersCountObservedAt'], ['followingCount', 'followingCountObservedAt']] as const) {
    if (incoming[field] !== undefined && (!current[date] || (incoming[date] && Date.parse(incoming[date]!) >= Date.parse(current[date]!)))) {
      patch[field] = incoming[field]; patch[date] = incoming[date];
    }
  }
  if (incoming.followsYou !== undefined && (!current.followsYouObservedAt
    || (incoming.followsYouObservedAt && Date.parse(incoming.followsYouObservedAt) >= Date.parse(current.followsYouObservedAt)))) {
    patch.followsYou = incoming.followsYou;
    patch.followsYouObservedAt = incoming.followsYouObservedAt;
    patch.followsYouViewerHandle = incoming.followsYouViewerHandle;
    patch.followsYouViewerId = incoming.followsYouViewerId
      ?? (incoming.followsYouViewerHandle === current.followsYouViewerHandle ? current.followsYouViewerId : undefined);
  }
  return patch;
}

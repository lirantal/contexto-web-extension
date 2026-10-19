import { describe, expect, it } from 'vitest';
import { parseXSearchTargetUrl } from '@/src/shared/platforms/x';

describe('sidebar search target from X URL', () => {
  it.each([
    ['https://x.com/Alice_Dev', 'alice_dev'],
    ['https://twitter.com/Bob_Dev/?lang=en', 'bob_dev'],
    ['https://x.com/Alice_Dev/status/123456789?s=20', 'alice_dev'],
    ['https://www.twitter.com/Bob_Dev/status/123/', 'bob_dev'],
  ])('resolves %s', (url, expected) => {
    expect(parseXSearchTargetUrl(url)).toBe(expected);
  });

  it.each([
    'https://x.com/home', 'https://x.com/search?q=alice',
    'https://x.com/i/status/123', 'https://x.com/messages',
    'https://x.com/alice/status/invalid', 'https://x.com/alice/unknown',
    'https://example.com/alice/status/123', 'https://x.com/handle_is_too_long',
    'https://x.com/alice/status/123/photo/1', 'file://x.com/alice', 'invalid',
  ])('ignores unsupported or ambiguous route %s', (url) => {
    expect(parseXSearchTargetUrl(url)).toBeUndefined();
  });
});

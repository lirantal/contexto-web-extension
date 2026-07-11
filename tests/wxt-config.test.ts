import { describe, expect, it } from 'vitest';
import config from '@/wxt.config';

describe('WXT React build configuration', () => {
  it('uses Vite\'s automatic JSX runtime', () => {
    expect(config.react?.vite?.jsxRuntime).not.toBe('classic');
  });
});

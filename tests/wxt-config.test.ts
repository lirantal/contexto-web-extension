import { describe, expect, it } from 'vitest';
import config from '@/wxt.config';

describe('WXT React build configuration', () => {
  it('uses the classic JSX runtime so production content scripts never call jsxDEV', () => {
    expect(config.react?.vite?.jsxRuntime).toBe('classic');
  });
});

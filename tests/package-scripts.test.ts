import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('release package scripts', () => {
  it('force production mode regardless of the inherited environment', async () => {
    const packageJson = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8'));

    expect(packageJson.scripts.build).toContain('cross-env NODE_ENV=production');
    expect(packageJson.scripts.zip).toContain('cross-env NODE_ENV=production');
  });
});

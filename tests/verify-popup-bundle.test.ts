import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyPopupBundle } from '@/scripts/verify-popup-bundle.mjs';

const temporaryDirectories: string[] = [];

async function createBundleFixture(chunks: Record<string, string>) {
  const output = await mkdtemp(join(tmpdir(), 'contexto-release-bundle-'));
  temporaryDirectories.push(output);

  await writeFile(output + '/popup.html', '<script type="module" src="/chunks/popup.js"></script>');
  await mkdir(output + '/chunks');
  await Promise.all(Object.entries(chunks).map(([file, contents]) => writeFile(join(output, 'chunks', file), contents)));

  return output;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe('release bundle verifier', () => {
  it('rejects classic JSX metadata from any generated chunk', async () => {
    const output = await createBundleFixture({
      'popup.js': 'export {}',
      'content.js': 'createElement("div", { __self: this })',
    });

    await expect(verifyPopupBundle(output)).rejects.toThrow('content.js contains classic JSX metadata');
  });

  it('rejects development JSX calls from any generated chunk', async () => {
    const output = await createBundleFixture({
      'popup.js': 'export {}',
      'content.js': 'jsxDEV("div", {}, undefined, false, undefined, this)',
    });

    await expect(verifyPopupBundle(output)).rejects.toThrow('content.js contains development JSX output');
  });
});

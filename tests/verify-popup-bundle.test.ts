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
  it('ignores JSX metadata in unrelated extension chunks', async () => {
    const output = await createBundleFixture({
      'popup.js': 'export {}',
      'content.js': 'createElement("div", { __self: this })',
    });

    await expect(verifyPopupBundle(output)).resolves.toBeUndefined();
  });


  it('rejects generated modulepreload hints in the popup', async () => {
    const output = await createBundleFixture({ 'popup.js': 'export {}' });
    await writeFile(join(output, 'popup.html'), `
      <script type="module" src="/chunks/popup.js"></script>
      <link rel="modulepreload" crossorigin href="/chunks/runtime.js">
    `);

    await expect(verifyPopupBundle(output)).rejects.toThrow('popup.html contains modulepreload hints');
  });

  it('rejects classic JSX metadata from the popup entry', async () => {
    const output = await createBundleFixture({
      'popup.js': 'createElement("div", { __self: this })',
      'content.js': 'export {}',
    });

    await expect(verifyPopupBundle(output)).rejects.toThrow('popup.js contains classic JSX metadata');
  });
  it('rejects development JSX calls from the popup entry', async () => {
    const output = await createBundleFixture({
      'popup.js': 'jsxDEV("div", {}, undefined, false, undefined, this)',
      'content.js': 'export {}',
    });

    await expect(verifyPopupBundle(output)).rejects.toThrow('popup.js contains development JSX output');
  });
});

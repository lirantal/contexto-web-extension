import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function verifyPopupBundle(output = resolve('.output/chrome-mv3')) {
  const html = await readFile(resolve(output, 'popup.html'), 'utf8');
  if (/<link\b[^>]*\brel\s*=\s*["']modulepreload["']/i.test(html)) {
    throw new Error('popup.html contains modulepreload hints that cause Chromium extension warnings');
  }
  const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1];

  if (!src) throw new Error('popup.html has no module entry');

  const source = resolve(output, src.replace(/^\//, ''));
  const bundle = await readFile(source, 'utf8');
  if (/\bjsxDEV\s*\(/.test(bundle)) throw new Error(`${src} contains development JSX output`);
  if (/\b__self\s*:/.test(bundle)) throw new Error(`${src} contains classic JSX metadata`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyPopupBundle();
  console.log('Release bundle JSX transform and preload policy verified');
}

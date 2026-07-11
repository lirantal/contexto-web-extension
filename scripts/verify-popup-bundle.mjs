import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function verifyPopupBundle(output = resolve('.output/chrome-mv3')) {
  const html = await readFile(resolve(output, 'popup.html'), 'utf8');
  const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1];

  if (!src) throw new Error('popup.html has no module entry');

  const source = resolve(output, src.replace(/^\//, ''));
  await readFile(source, 'utf8');

  const files = await readdir(output, { recursive: true });
  for (const file of files.filter((file) => file.endsWith('.js'))) {
    const bundle = await readFile(resolve(output, file), 'utf8');
    if (/\bjsxDEV\s*\(/.test(bundle)) throw new Error(`${file} contains development JSX output`);
    if (/\b__self\s*:/.test(bundle)) throw new Error(`${file} contains classic JSX metadata`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyPopupBundle();
  console.log('Release bundle JSX transform verified');
}

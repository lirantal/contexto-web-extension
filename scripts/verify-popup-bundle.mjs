import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('.output/chrome-mv3');
const html = await readFile(resolve(output, 'popup.html'), 'utf8');
const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1];

if (!src) throw new Error('popup.html has no module entry');

const bundle = await readFile(resolve(output, src.replace(/^\//, '')), 'utf8');
if (/\bReact\.createElement\b/.test(bundle)) {
  throw new Error('Popup bundle contains an unbound classic-JSX React reference');
}
console.log('Popup bundle React binding verified');

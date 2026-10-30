import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

/** Optional env files load quietly; shell values win, then the later file wins. */
export async function loadLocalEnv({ files = ['.env', '.env.x-export'], env = process.env } = {}) {
  const inherited = new Set(Object.keys(env));
  for (const file of files) {
    let content;
    try { content = await readFile(file, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') continue;
      throw new Error(`Cannot read env file ${file}; check its permissions`);
    }
    let values;
    try { values = parseEnv(content); }
    catch { throw new Error(`Cannot parse env file ${file}; contents were not logged`); }
    for (const [key, value] of Object.entries(values)) if (!inherited.has(key)) env[key] = value;
  }
}

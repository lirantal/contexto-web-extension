import { mkdir, open, readFile, rename, rm, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readJson(path, fallback) {
  let content;
  try { content = await readFile(path, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw new Error(`Cannot read ${path}; check that the file exists and is readable`);
  }
  try { return JSON.parse(content); }
  catch { throw new Error(`Invalid JSON in ${path}; file contents were not logged`); }
}
export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}
export async function withLock(directory, action) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const path = `${directory}/.lock`;
  let lock;
  try { lock = await open(path, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another command may be running. If it crashed, verify it stopped before removing ${path}`);
    throw error;
  }
  try { await lock.writeFile(String(process.pid)); return await action(); }
  finally { await lock.close(); await rm(path, { force: true }); }
}

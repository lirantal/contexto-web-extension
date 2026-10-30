import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const archive = `.output/contexto-${version}-chrome.zip`;
assert.ok(readdirSync('.output').includes(archive.split('/').pop()), 'Versioned Chromium ZIP missing');
const manifest = JSON.parse(execFileSync('unzip', ['-p', archive, 'manifest.json'], { encoding: 'utf8' }));
assert.equal(manifest.version, version, 'Bundle and package versions must match');
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, 'Contexto');
console.log(`Validated ${archive} (MV3, version ${version})`);

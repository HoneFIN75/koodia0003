import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { access, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function assertExists(relativePath) {
  await access(path.join(rootDir, relativePath));
}

test('build copies PHP API deployment assets', async () => {
  await execFileAsync('node', ['scripts/build.mjs'], { cwd: rootDir });

  await assertExists('dist/.htaccess');
  await assertExists('dist/api/index.php');
  await assertExists('dist/api/.htaccess');

  const apiEntries = await readdir(path.join(rootDir, 'dist/api'));
  assert.deepEqual(new Set(apiEntries), new Set(['.htaccess', 'index.php']));
});

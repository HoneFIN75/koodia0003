import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('navigation stays sticky and uses the specified SFL states', async () => {
  const css = await readFile(path.join(rootDir, 'css/styles.css'), 'utf8');

  assert.match(css, /\.site-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s);
  assert.match(css, /--color-sfl-blue:\s*#004a8c;/);
  assert.match(css, /--color-sfl-white:\s*#ffffff;/);
  assert.match(css, /--color-sfl-green:\s*#036d49;/);
  assert.match(css, /--color-sfl-dark:\s*#303030;/);
  assert.match(css, /--color-sfl-light-gray:\s*#c7c7c7;/);
  assert.match(css, /\.main-nav button\[aria-current="page"\]\s*\{[^}]*font-weight:\s*700;/s);
  assert.match(css, /\.main-nav button:not\(\[aria-current="page"\]\):hover\s*\{[^}]*var\(--color-sfl-light-gray\)/s);
});

test('mobile navigation always lays out all nine buttons in two rows', async () => {
  const css = await readFile(path.join(rootDir, 'css/styles.css'), 'utf8');
  const mobileRules = css.slice(css.indexOf('@media (max-width: 780px)'));

  assert.match(mobileRules, /\.main-nav ul\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\);/s);
  assert.doesNotMatch(css, /\.main-nav\[hidden\]/);
});

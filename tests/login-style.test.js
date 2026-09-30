import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function getRuleBody(css, selector) {
  const match = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
}

test('login background image is used only on the login page and is not stretched', async () => {
  const css = await readFile(path.join(rootDir, 'css/styles.css'), 'utf8');
  const loginPageRule = getRuleBody(css, '.login-page');

  assert.match(css, /--login-background-image:\s*url\("\.\.\/assets\/login-background\.png"\)/);
  assert.match(loginPageRule, /var\(--login-background-image\)/);
  assert.match(loginPageRule, /background-size:\s*cover;/);
  assert.match(loginPageRule, /background-position:\s*center;/);
  assert.match(loginPageRule, /background-repeat:\s*no-repeat;/);

  const usages = css.match(/var\(--login-background-image\)/g) ?? [];
  assert.equal(usages.length, 1);
  const imageUrls = css.match(/url\([^)]*login-background[^)]*\)/g) ?? [];
  assert.equal(imageUrls.length, 1);
});

test('login card uses a translucent surface on top of the background image', async () => {
  const css = await readFile(path.join(rootDir, 'css/styles.css'), 'utf8');
  const loginCardRule = getRuleBody(css, '.login-card');

  assert.match(loginCardRule, /background:\s*rgba\(255,\s*255,\s*255,\s*0\.5\);/);
  assert.doesNotMatch(loginCardRule, /opacity:/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
const buttonStyles = css.slice(css.indexOf('/* Painikkeet:'));
const actionStyles = css.slice(css.indexOf('/* Sisältötoiminnot:'));

test('all non-navigation buttons share dimensions and single-line labels', () => {
  assert.match(css, /--button-height:\s*2\.875rem/);
  assert.match(css, /--button-padding:\s*0\.65rem 1rem/);
  assert.match(css, /--button-radius:\s*var\(--border-radius-sm\)/);
  assert.match(buttonStyles, /button:not\(\.main-nav button\),\s*\.secondary-link-button\s*\{[^}]*height:\s*var\(--button-height\);[^}]*padding:\s*var\(--button-padding\);[^}]*border-radius:\s*var\(--button-radius\);[^}]*font-size:\s*var\(--button-font-size\);[^}]*font-weight:\s*var\(--button-font-weight\);[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis/s);
  assert.match(buttonStyles, /button:not\(\.main-nav button\):focus-visible,\s*\.secondary-link-button:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus-ring\)/s);
  assert.match(buttonStyles, /button:not\(\.main-nav button\):not\(:disabled\):hover,\s*\.secondary-link-button:hover\s*\{/);
  assert.match(buttonStyles, /button:not\(\.main-nav button\):disabled\s*\{[^}]*cursor:\s*not-allowed/s);
  assert.match(buttonStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition:\s*none/);
  assert.match(css, /\.main-nav button\s*\{[^}]*min-height:\s*2\.5rem/);
});

test('button variants only customize colors and keep shared spacing', () => {
  assert.match(css, /--button-gap:\s*var\(--spacing-sm\)/);
  assert.match(buttonStyles, /\.button\s*\{[^}]*--button-background:\s*var\(--color-primary\)/s);
  assert.match(buttonStyles, /\.danger-button\s*\{[^}]*--button-background:\s*var\(--color-error-surface\)/s);
  assert.match(actionStyles, /\.action-footer\s*\{[^}]*gap:\s*var\(--button-gap\)/s);
  assert.doesNotMatch(actionStyles, /margin-inline-start:\s*auto/);
});

test('button groups retain responsive layout', () => {
  assert.match(actionStyles, /@media \(max-width: 600px\)[\s\S]*flex-direction:\s*column/);
  assert.match(actionStyles, /@media \(min-width: 601px\) and \(max-width: 780px\)[\s\S]*flex-direction:\s*row/);
});

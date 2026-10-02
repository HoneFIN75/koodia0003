import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
const actionStyles = css.slice(css.indexOf('/* Sisältötoiminnot:'));

test('button polish only targets explicitly scoped content, including responsive and motion rules', () => {
  assert.ok(actionStyles.length > 0);
  const selectors = [...actionStyles.matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim())
    .filter((selector) => !selector.startsWith('@media'));

  assert.ok(selectors.length > 20);
  for (const selector of selectors) {
    assert.ok(selector.startsWith('.action-surface ') || selector.startsWith('.action-surface.'), selector);
    assert.doesNotMatch(selector, /main-nav|site-header|:root/);
  }
  assert.match(actionStyles, /min-height:\s*2\.875rem/);
  assert.match(actionStyles, /:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-primary\)/s);
  assert.match(actionStyles, /:disabled\s*\{[^}]*box-shadow:\s*none;[^}]*cursor:\s*not-allowed/s);
  assert.match(actionStyles, /\[aria-busy="true"\]\s*\{[^}]*cursor:\s*progress/s);
  assert.match(actionStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition:\s*none/);
});

test('scoped footers align neutral left and submit right without changing DOM/tab order', () => {
  assert.match(actionStyles, /\.action-footer > :is\(\.button, \.danger-action-button\)\s*\{[^}]*order:\s*1;[^}]*margin-inline-start:\s*auto/s);
  assert.match(actionStyles, /\.action-footer > \.action-neutral\s*\{[^}]*order:\s*-1/s);
  assert.match(actionStyles, /@media \(max-width: 600px\)[\s\S]*flex-direction:\s*column/);
  assert.match(actionStyles, /@media \(min-width: 601px\) and \(max-width: 780px\)[\s\S]*flex-direction:\s*row/);
});

test('tournament edit button text does not wrap', () => {
  assert.match(css, /\.tournaments-table \[data-edit-tournament\]\s*\{[^}]*white-space:\s*nowrap/s);
});

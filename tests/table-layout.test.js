import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');

test('Yhteenveto-taulukot mahtuvat rinnakkaisiin kortteihin', () => {
  assert.match(css, /\.summary-tables\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.summary-table\s*\{[^}]*table-layout:\s*fixed/s);
  assert.match(css, /\.summary-table th,\s*\.summary-table td\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap/s);
  assert.match(css, /@media \(max-width:\s*780px\)[\s\S]*\.two-column,\s*\.form-grid[\s\S]*grid-template-columns:\s*1fr/);
});

test('Turnaustaulukko käyttää kiinteää asettelua ja jättää vaakavierityksen vain pienille näytöille', () => {
  assert.match(css, /\.tournaments-table\s*\{[^}]*table-layout:\s*fixed/s);
  assert.match(css, /\.tournaments-table th,\s*\.tournaments-table td\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap/s);
  assert.match(css, /@media \(max-width:\s*780px\)\s*\{\s*\.tournaments-table\s*\{\s*min-width:\s*760px/s);
  assert.match(css, /\.tournaments-table td:last-child \.secondary-button\s*\{[^}]*padding-right:\s*0\.5rem;[^}]*padding-left:\s*0\.5rem/s);
});

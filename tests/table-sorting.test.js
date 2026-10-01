import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFinnishNumber, sortTableRows, toggleSortState } from '../js/table-sorting.js';

test('parseFinnishNumber tukee suomalaisia desimaaleja', () => {
  assert.equal(parseFinnishNumber('1,25'), 1.25);
  assert.equal(parseFinnishNumber('99'), 99);
  assert.ok(Number.isNaN(parseFinnishNumber('abc')));
});

test('sortTableRows lajittelee tekstin fi-lokaalilla', () => {
  const rows = [{ name: 'Örni' }, { name: 'Aatu' }, { name: 'Äke' }];

  const asc = sortTableRows(rows, { field: 'name', direction: 'asc' }, { name: { type: 'text' } });
  const desc = sortTableRows(rows, { field: 'name', direction: 'desc' }, { name: { type: 'text' } });

  assert.deepEqual(
    asc.map((row) => row.name),
    ['Aatu', 'Äke', 'Örni'],
  );
  assert.deepEqual(
    desc.map((row) => row.name),
    ['Örni', 'Äke', 'Aatu'],
  );
});

test('sortTableRows lajittelee numerot oikein myös pilkkudesimaaleilla', () => {
  const rows = [{ value: '1,25' }, { value: '10' }, { value: '2,5' }];

  const asc = sortTableRows(rows, { field: 'value', direction: 'asc' }, { value: { type: 'number' } });
  const desc = sortTableRows(rows, { field: 'value', direction: 'desc' }, { value: { type: 'number' } });

  assert.deepEqual(
    asc.map((row) => row.value),
    ['1,25', '2,5', '10'],
  );
  assert.deepEqual(
    desc.map((row) => row.value),
    ['10', '2,5', '1,25'],
  );
});

test('sortTableRows lajittelee päivämäärät vanhimmasta uusimpaan ja takaisin', () => {
  const rows = [{ date: '2027-07-03' }, { date: '2026-01-01' }, { date: '2027-01-01' }];

  const asc = sortTableRows(rows, { field: 'date', direction: 'asc' }, { date: { type: 'date' } });
  const desc = sortTableRows(rows, { field: 'date', direction: 'desc' }, { date: { type: 'date' } });

  assert.deepEqual(
    asc.map((row) => row.date),
    ['2026-01-01', '2027-01-01', '2027-07-03'],
  );
  assert.deepEqual(
    desc.map((row) => row.date),
    ['2027-07-03', '2027-01-01', '2026-01-01'],
  );
});

test('sortTableRows käsittelee tyhjät arvot lajittelusuunnan mukaan', () => {
  const rows = [{ value: '' }, { value: 'B' }, { value: 'A' }];

  const asc = sortTableRows(rows, { field: 'value', direction: 'asc' }, { value: { type: 'text' } });
  const desc = sortTableRows(rows, { field: 'value', direction: 'desc' }, { value: { type: 'text' } });

  assert.deepEqual(
    asc.map((row) => row.value),
    ['A', 'B', ''],
  );
  assert.deepEqual(
    desc.map((row) => row.value),
    ['', 'B', 'A'],
  );
});

test('sortTableRows lajittelee puuttuvat ratingit ja rankingit numeroarvojen kanssa', () => {
  const rows = [{ pdgaRating: null, worldRank: 85 }, { pdgaRating: 998, worldRank: null }, { pdgaRating: 950, worldRank: 120 }];
  for (const field of ['pdgaRating', 'worldRank']) {
    const config = { [field]: { type: 'number' } };
    assert.equal(sortTableRows(rows, { field, direction: 'asc' }, config).at(-1)[field], null);
    assert.equal(sortTableRows(rows, { field, direction: 'desc' }, config)[0][field], null);
  }
});

test('toggleSortState vaihtaa suuntaa samalla kentällä ja nollaa uudelle kentälle', () => {
  const first = toggleSortState({ field: 'name', direction: 'asc' }, 'name');
  const second = toggleSortState(first, 'name');
  const changedField = toggleSortState(second, 'pdgaNumber');

  assert.deepEqual(first, { field: 'name', direction: 'desc' });
  assert.deepEqual(second, { field: 'name', direction: 'asc' });
  assert.deepEqual(changedField, { field: 'pdgaNumber', direction: 'asc' });
});

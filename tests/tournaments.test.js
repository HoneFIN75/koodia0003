import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTournament,
  DEFAULT_TOURNAMENT_DISPLAY_ORDER,
  filterAndSortTournaments,
  importTournamentsFromCsv,
  sortTournaments,
  TournamentValidationError,
} from '../js/tournaments.js';

test('creates a tournament without unknown legacy fields', () => {
  const tournament = createTournament({
    name: 'SFL Open',
    multiplierKey: 'fpt',
    startDate: '2026-07-03',
    displayOrder: '7',
    pdgaEventId: '123456',
    legacyField: 'poistuva arvo',
  });

  assert.equal(tournament.name, 'SFL Open');
  assert.equal(tournament.multiplierKey, 'fpt');
  assert.equal(tournament.multiplier, 1);
  assert.equal(tournament.displayOrder, 7);
  assert.equal(tournament.pdgaEventId, 123456);
  assert.ok(!Object.hasOwn(tournament, 'legacyField'));
});

test('rejects empty or invalid display order with field error', () => {
  assert.throws(
    () =>
      createTournament({
        name: 'SFL Open',
        multiplierKey: 'fpt',
        startDate: '2026-07-03',
        displayOrder: '0',
      }),
    (error) => {
      assert.ok(error instanceof TournamentValidationError);
      assert.equal(error.fieldErrors.displayOrder, 'Järjestysnumeron pitää olla positiivinen kokonaisluku.');
      return true;
    },
  );
});

test('rejects invalid PDGA event id', () => {
  assert.throws(
    () =>
      createTournament({
        name: 'SFL Open',
        multiplierKey: 'fpt',
        startDate: '2026-07-03',
        displayOrder: '7',
        pdgaEventId: 'abc',
      }),
    (error) => {
      assert.ok(error instanceof TournamentValidationError);
      assert.equal(error.fieldErrors.pdgaEventId, 'PDGA-kilpailutunnus pitää olla positiivinen kokonaisluku.');
      return true;
    },
  );
});

test('sorts tournaments deterministically by display order, date, createdAt and id', () => {
  const tournaments = [
    {
      id: 'tournament-b',
      name: 'B',
      displayOrder: 2,
      startDate: '2026-07-02',
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'tournament-d',
      name: 'D',
      displayOrder: 1,
      startDate: '2026-07-01',
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'tournament-a',
      name: 'A',
      displayOrder: 1,
      startDate: '2026-07-01',
      createdAt: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'tournament-c',
      name: 'C',
      displayOrder: 1,
      startDate: '2026-07-03',
      createdAt: '2026-01-01T08:00:00.000Z',
    },
  ];

  const sortedIds = sortTournaments(tournaments).map((tournament) => tournament.id);

  assert.deepEqual(sortedIds, ['tournament-a', 'tournament-d', 'tournament-c', 'tournament-b']);
});

test('filters tournaments by search and sorts by configured field', () => {
  const tournaments = [
    {
      id: 'tournament-1',
      name: 'Lahti Open',
      status: 'Vahvistettu',
      location: 'Lahti',
      venue: 'Mukkula',
      startDate: '2026-07-05',
      endDate: '2026-07-06',
      displayOrder: 3,
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'tournament-2',
      name: 'Turku Masters',
      status: 'Luonnos',
      location: 'Turku',
      venue: 'Aninkainen',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      displayOrder: 1,
      createdAt: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'tournament-3',
      name: 'Lahti Challenge',
      status: 'Vahvistettu',
      location: 'Lahti',
      venue: 'Tali',
      startDate: '2026-07-03',
      endDate: '2026-07-04',
      displayOrder: 2,
      createdAt: '2026-01-01T08:00:00.000Z',
    },
  ];

  const filteredIds = filterAndSortTournaments(tournaments, {
    search: 'lahti',
    status: 'Vahvistettu',
    sortField: 'name',
    sortDirection: 'asc',
  }).map((tournament) => tournament.id);

  assert.deepEqual(filteredIds, ['tournament-3', 'tournament-1']);
});

test('imports tournaments from CSV and skips duplicates by PDGA Event ID', () => {
  const existingTournament = {
    id: 'tournament-existing',
    name: 'Olemassa oleva',
    pdgaEventId: 123456,
  };
  const csv =
    'PDGA Event ID;Turnauksen nimi\n123456;Duplicate Event\n123457;European Open 2027\n123457;Toinen samalla tunnuksella\n';

  const { importedTournaments, summary } = importTournamentsFromCsv([existingTournament], csv);

  assert.equal(importedTournaments.length, 1);
  assert.equal(importedTournaments[0].name, 'European Open 2027');
  assert.equal(importedTournaments[0].pdgaEventId, 123457);
  assert.equal(importedTournaments[0].displayOrder, DEFAULT_TOURNAMENT_DISPLAY_ORDER);
  assert.equal(summary.totalRows, 3);
  assert.equal(summary.importedCount, 1);
  assert.equal(summary.duplicateCount, 2);
  assert.equal(summary.validationErrorCount, 0);
  assert.deepEqual(summary.failures, [
    { rowNumber: 2, reason: 'PDGA Event ID on jo järjestelmässä (123456)' },
    { rowNumber: 4, reason: 'PDGA Event ID on jo järjestelmässä (123457)' },
  ]);
});

test('imports tournaments CSV reports required and validation errors', () => {
  const csv = 'PDGA Event ID;Turnauksen nimi\n;Nimi puuttuu tunnukselta\nABC123;Virheellinen tunnus\n200001;\n';
  const { importedTournaments, summary } = importTournamentsFromCsv([], csv);

  assert.equal(importedTournaments.length, 0);
  assert.equal(summary.totalRows, 3);
  assert.equal(summary.importedCount, 0);
  assert.equal(summary.duplicateCount, 0);
  assert.equal(summary.validationErrorCount, 3);
  assert.deepEqual(summary.failures, [
    { rowNumber: 2, reason: 'PDGA Event ID puuttuu' },
    { rowNumber: 3, reason: 'Virheellinen PDGA Event ID' },
    { rowNumber: 4, reason: 'Turnauksen nimi puuttuu' },
  ]);
});

test('importTournamentsFromCsv reports empty CSV as validation summary', () => {
  const headerOnly = importTournamentsFromCsv([], 'PDGA Event ID;Turnauksen nimi\n');
  const emptyFile = importTournamentsFromCsv([], '\n\n');

  assert.equal(headerOnly.summary.totalRows, 0);
  assert.equal(headerOnly.summary.importedCount, 0);
  assert.equal(headerOnly.summary.validationErrorCount, 1);
  assert.deepEqual(headerOnly.summary.failures, [{ rowNumber: 1, reason: 'CSV-tiedostossa ei ole tuotavia turnausrivejä.' }]);
  assert.equal(emptyFile.summary.validationErrorCount, 1);
});

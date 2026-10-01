import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTournament,
  filterAndSortTournaments,
  importTournamentsFromCsv,
  sortTournaments,
  TournamentValidationError,
} from '../js/tournaments.js';

test('creates a tournament without unknown legacy fields', () => {
  const tournament = createTournament([], [{ id: 'multiplier-1' }], {
    name: 'SFL Open',
    multiplierId: 'multiplier-1',
    startDate: '2026-07-03',
    displayOrder: '7',
    pdgaEventId: '123456',
    legacyField: 'poistuva arvo',
  });

  assert.equal(tournament.name, 'SFL Open');
  assert.equal(tournament.multiplierId, 'multiplier-1');
  assert.equal(tournament.displayOrder, 7);
  assert.equal(tournament.pdgaEventId, 123456);
  assert.ok(!Object.hasOwn(tournament, 'legacyField'));
});

test('rejects empty or invalid display order with field error', () => {
  assert.throws(
    () =>
      createTournament([], [{ id: 'multiplier-1' }], {
        name: 'SFL Open',
        multiplierId: 'multiplier-1',
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
      createTournament([], [{ id: 'multiplier-1' }], {
        name: 'SFL Open',
        multiplierId: 'multiplier-1',
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

test('rejects missing multiplier reference', () => {
  assert.throws(
    () =>
      createTournament([], [{ id: 'multiplier-1' }], {
        name: 'SFL Open',
        startDate: '2026-07-03',
        displayOrder: '7',
        multiplierId: '',
      }),
    (error) => {
      assert.ok(error instanceof TournamentValidationError);
      assert.equal(error.fieldErrors.multiplierId, 'Tila on pakollinen.');
      return true;
    },
  );
});

test('rejects unknown multiplier reference', () => {
  assert.throws(
    () =>
      createTournament([], [{ id: 'multiplier-1' }], {
        name: 'SFL Open',
        startDate: '2026-07-03',
        displayOrder: '7',
        multiplierId: 'unknown-id',
      }),
    (error) => {
      assert.ok(error instanceof TournamentValidationError);
      assert.equal(error.fieldErrors.multiplierId, 'Valittu tila ei ole enää käytettävissä.');
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
      multiplierId: 'major',
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
      multiplierId: 'c-tier',
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
      multiplierId: 'major',
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
    status: 'major',
    sortField: 'name',
    sortDirection: 'asc',
  }).map((tournament) => tournament.id);

  assert.deepEqual(filteredIds, ['tournament-3', 'tournament-1']);
});

test('imports tournaments from CSV and skips duplicates by PDGA Event ID', () => {
  const existingTournament = {
    id: 'tournament-existing',
    name: 'Olemassa oleva',
    displayOrder: 1,
    pdgaEventId: 123456,
  };
  const csv =
    'Järjestysnumero;PDGA Event ID;Turnauksen nimi\n2;123456;Duplicate Event\n3;123457;European Open 2027\n4;123457;Toinen samalla tunnuksella\n';

  const { importedTournaments, summary } = importTournamentsFromCsv([existingTournament], csv);

  assert.equal(importedTournaments.length, 1);
  assert.equal(importedTournaments[0].name, 'European Open 2027');
  assert.equal(importedTournaments[0].pdgaEventId, 123457);
  assert.equal(importedTournaments[0].displayOrder, 3);
  assert.equal(summary.totalRows, 3);
  assert.equal(summary.importedCount, 1);
  assert.equal(summary.duplicateCount, 2);
  assert.equal(summary.validationErrorCount, 0);
  assert.deepEqual(summary.failures, [
    { rowNumber: 2, reason: 'PDGA Event ID on jo olemassa (123456)' },
    { rowNumber: 4, reason: 'PDGA Event ID on jo olemassa (123457)' },
  ]);
});

test('imports tournaments CSV reports required and validation errors', () => {
  const csv =
    'Järjestysnumero;PDGA Event ID;Turnauksen nimi\n;200001;Järjestys puuttuu\nX;200002;Virheellinen järjestys\n3;;PDGA puuttuu\n4;ABC123;Virheellinen tunnus\n5;200004;\n';
  const { importedTournaments, summary } = importTournamentsFromCsv([], csv);

  assert.equal(importedTournaments.length, 0);
  assert.equal(summary.totalRows, 5);
  assert.equal(summary.importedCount, 0);
  assert.equal(summary.duplicateCount, 0);
  assert.equal(summary.validationErrorCount, 5);
  assert.deepEqual(summary.failures, [
    { rowNumber: 2, reason: 'Järjestysnumero puuttuu' },
    { rowNumber: 3, reason: 'Virheellinen järjestysnumero' },
    { rowNumber: 4, reason: 'PDGA Event ID puuttuu' },
    { rowNumber: 5, reason: 'Virheellinen PDGA Event ID' },
    { rowNumber: 6, reason: 'Turnauksen nimi puuttuu' },
  ]);
});

test('imports tournaments CSV validates unique display order against existing and imported rows', () => {
  const existingTournament = {
    id: 'tournament-existing',
    name: 'Olemassa oleva',
    displayOrder: 2,
    pdgaEventId: 123450,
  };
  const csv =
    'Järjestysnumero;PDGA Event ID;Turnauksen nimi\n2;123451;Sama järjestys kuin olemassa olevalla\n3;123452;Ensimmäinen\n3;123453;Sama järjestys tuontiriveillä\n';

  const { importedTournaments, summary } = importTournamentsFromCsv([existingTournament], csv);

  assert.equal(importedTournaments.length, 1);
  assert.equal(importedTournaments[0].displayOrder, 3);
  assert.equal(summary.importedCount, 1);
  assert.equal(summary.duplicateCount, 0);
  assert.equal(summary.validationErrorCount, 2);
  assert.deepEqual(summary.failures, [
    { rowNumber: 2, reason: 'Järjestysnumero on jo käytössä (2)' },
    { rowNumber: 4, reason: 'Järjestysnumero on jo käytössä (3)' },
  ]);
});

test('importTournamentsFromCsv reports empty CSV as validation summary', () => {
  const headerOnly = importTournamentsFromCsv([], 'Järjestysnumero;PDGA Event ID;Turnauksen nimi\n');
  const emptyFile = importTournamentsFromCsv([], '\n\n');

  assert.equal(headerOnly.summary.totalRows, 0);
  assert.equal(headerOnly.summary.importedCount, 0);
  assert.equal(headerOnly.summary.validationErrorCount, 1);
  assert.deepEqual(headerOnly.summary.failures, [{ rowNumber: 1, reason: 'CSV-tiedostossa ei ole tuotavia turnausrivejä.' }]);
  assert.equal(emptyFile.summary.validationErrorCount, 1);
});

test('filterAndSortTournaments uses display order as default sorting', () => {
  const tournaments = [
    { id: 'tournament-1', name: 'A', displayOrder: 5, createdAt: '2026-01-01T10:00:00.000Z' },
    { id: 'tournament-2', name: 'B', displayOrder: 2, createdAt: '2026-01-01T10:00:00.000Z' },
    { id: 'tournament-3', name: 'C', displayOrder: 3, createdAt: '2026-01-01T10:00:00.000Z' },
  ];

  const sortedIds = filterAndSortTournaments(tournaments).map((tournament) => tournament.id);

  assert.deepEqual(sortedIds, ['tournament-2', 'tournament-3', 'tournament-1']);
});

test('allows 000000 as unassigned PDGA Event ID and preserves it', () => {
  const tournament = createTournament([], [{ id: 'multiplier-1' }], {
    name: 'TBA Event',
    multiplierId: 'multiplier-1',
    startDate: '2026-07-03',
    displayOrder: '1',
    pdgaEventId: '000000',
  });

  assert.equal(tournament.pdgaEventId, '000000');
});

test('imports multiple tournaments with 000000 without treating them as duplicates', () => {
  const existingTournament = {
    id: 'tournament-existing',
    name: 'Vanha TBA',
    displayOrder: 1,
    pdgaEventId: '000000',
  };
  const csv =
    'Järjestysnumero;PDGA Event ID;Turnauksen nimi\n2;000000;Uusi TBA 1\n3;000000;Uusi TBA 2\n';

  const { importedTournaments, summary } = importTournamentsFromCsv([existingTournament], csv);

  assert.equal(importedTournaments.length, 2);
  assert.equal(summary.importedCount, 2);
  assert.equal(summary.duplicateCount, 0);
  assert.equal(importedTournaments[0].pdgaEventId, '000000');
  assert.equal(importedTournaments[1].pdgaEventId, '000000');
});


import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayer,
  updatePlayer,
  validatePlayerInput,
  removePlayer,
  canRequestPlayerDeletion,
  PlayerValidationError,
  getVisiblePlayers,
  importPlayersFromCsv,
  parseRatingRankingCsv,
  importRatingRankingFromCsv,
} from '../js/players.js';

test('parses rating and ranking CSV with BOM, CRLF and original row numbers', () => {
  const parsed = parseRatingRankingCsv('\uFEFFPDGA ID;Rating;Ranking\r\n"12345";"998";"120"\r\n\r\n56789;1021;34\r\n');
  assert.deepEqual(parsed, {
    rows: [
      { rowNumber: 2, pdgaNumber: 12345, pdgaRating: 998, worldRank: 120 },
      { rowNumber: 4, pdgaNumber: 56789, pdgaRating: 1021, worldRank: 34 },
    ],
    errors: [],
  });
});

test('rating and ranking CSV reports invalid headers, values and duplicate IDs', () => {
  assert.throws(() => parseRatingRankingCsv('PDGA ID;Ranking;Rating\n123;1;2'), /otsikko/);
  assert.throws(() => parseRatingRankingCsv('PDGA ID;Rating;Ranking\n'), /pelaajarivejä/);
  const parsed = parseRatingRankingCsv('PDGA ID;Rating;Ranking\n123;998;120\n123;999;121\n;998;120\n55;0;1\n66;123;1,5\n77;123\n');
  assert.deepEqual(parsed.rows, []);
  assert.deepEqual(parsed.errors.map(({ rowNumber, pdgaId }) => [rowNumber, pdgaId]), [
    [2, '123'], [3, '123'], [4, ''], [5, '55'], [6, '66'], [7, '77'],
  ]);
});

test('rating and ranking import only updates two fields on existing PDGA matches', () => {
  const player = {
    ...createPlayer([], { firstName: 'Matti', lastName: 'Meikäläinen', division: 'MPO', pdgaNumber: '12345' }),
    pdgaRating: 900, worldRank: 200, notes: 'Säilyy', rankingPoints: 72,
  };
  const other = createPlayer([], { firstName: 'Maija', lastName: 'Mallikas', division: 'FPO', pdgaNumber: '98765' });
  const players = [player, other];
  const { updatedPlayers, summary } = importRatingRankingFromCsv(
    players,
    'PDGA ID;Rating;Ranking\n12345;998;120\n56789;1021;34\n12345;1000;1\n',
  );
  assert.deepEqual(updatedPlayers, players);
  assert.equal(summary.updatedCount, 0);
  assert.equal(summary.errors.length, 2);
  assert.equal(summary.observations.length, 1);
  assert.match(summary.observations[0].reason, /ei löydy/);

  const imported = importRatingRankingFromCsv(players, 'PDGA ID;Rating;Ranking\n12345;998;120\n56789;1021;34');
  assert.deepEqual(imported.updatedPlayers[0], { ...player, pdgaRating: 998, worldRank: 120 });
  assert.strictEqual(imported.updatedPlayers[1], other);
  assert.deepEqual(players, [player, other]);
  assert.equal(imported.summary.updatedCount, 1);
  assert.equal(imported.summary.errors.length, 0);
  assert.equal(imported.summary.observations.length, 1);
});

test('creates an MPO player', () => {
  const player = createPlayer([], {
    firstName: 'Matti',
    lastName: 'Meikäläinen',
    division: 'MPO',
    pdgaNumber: '12345',
    pdgaRating: '1012',
    legacyField: 'poistuva arvo',
  });

  assert.equal(player.firstName, 'Matti');
  assert.equal(player.lastName, 'Meikäläinen');
  assert.equal(player.name, 'Matti Meikäläinen');
  assert.equal(player.division, 'MPO');
  assert.equal(player.pdgaNumber, 12345);
  assert.equal(player.pdgaRating, 1012);
  assert.ok(!Object.hasOwn(player, 'legacyField'));
  assert.ok(!Object.hasOwn(player, 'pdgaProfileUrl'));
});

test('creates an FPO player', () => {
  const player = createPlayer([], {
    firstName: 'Maija',
    lastName: 'Mallikas',
    division: 'FPO',
    pdgaNumber: '9876',
    worldRank: '12',
  });

  assert.equal(player.name, 'Maija Mallikas');
  assert.equal(player.division, 'FPO');
  assert.equal(player.worldRank, 12);
});

test('updates a player', () => {
  const created = createPlayer([], {
    firstName: 'Alkuperäinen',
    lastName: 'Pelaaja',
    division: 'MPO',
    pdgaNumber: '501',
  });
  const existingPlayer = { ...created, updatedAt: '2024-01-01T00:00:00.000Z' };

  const updated = updatePlayer([existingPlayer], existingPlayer.id, {
    ...existingPlayer,
    firstName: 'Päivitetty',
    lastName: 'Pelaaja',
    division: 'FPO',
    pdgaNumber: '601',
  });

  assert.equal(updated.name, 'Päivitetty Pelaaja');
  assert.equal(updated.division, 'FPO');
  assert.equal(updated.pdgaNumber, 601);
  assert.notEqual(updated.updatedAt, existingPlayer.updatedAt);
});

test('validates required first and last names', () => {
  assert.throws(
    () =>
      validatePlayerInput(
        {
          firstName: '',
          lastName: '',
          division: 'MPO',
          pdgaNumber: '123',
        },
        [],
      ),
    (error) =>
      error instanceof PlayerValidationError &&
      error.fieldErrors.firstName === 'Etunimi on pakollinen.' &&
      error.fieldErrors.lastName === 'Sukunimi on pakollinen.',
  );
});

test('rejects invalid PDGA number', () => {
  assert.throws(
    () =>
      validatePlayerInput(
        {
          firstName: 'Virheellinen',
          lastName: 'Pelaaja',
          division: 'MPO',
          pdgaNumber: '0',
        },
        [],
      ),
    (error) =>
      error instanceof PlayerValidationError &&
      error.fieldErrors.pdgaNumber === 'PDGA-numero pitää olla positiivinen kokonaisluku.',
  );
});

test('requires PDGA number', () => {
  assert.throws(
    () =>
      validatePlayerInput(
        {
          firstName: 'Puuttuva',
          lastName: 'PDGA',
          division: 'MPO',
          pdgaNumber: '',
        },
        [],
      ),
    (error) => error instanceof PlayerValidationError && error.fieldErrors.pdgaNumber === 'PDGA-numero on pakollinen.',
  );
});

test('createPlayer rejects missing required PDGA number', () => {
  assert.throws(
    () =>
      createPlayer([], {
        firstName: 'Testi',
        lastName: 'IlmanPdga',
        division: 'MPO',
        pdgaNumber: '',
      }),
    (error) => error instanceof PlayerValidationError && error.fieldErrors.pdgaNumber === 'PDGA-numero on pakollinen.',
  );
});

test('updatePlayer rejects missing required PDGA number', () => {
  const existingPlayer = createPlayer([], {
    firstName: 'Testi',
    lastName: 'Pelaaja',
    division: 'MPO',
    pdgaNumber: '1234',
  });

  assert.throws(
    () =>
      updatePlayer([existingPlayer], existingPlayer.id, {
        ...existingPlayer,
        pdgaNumber: '',
      }),
    (error) => error instanceof PlayerValidationError && error.fieldErrors.pdgaNumber === 'PDGA-numero on pakollinen.',
  );
});

test('updatePlayer supports legacy player that originally had no PDGA number', () => {
  const legacyPlayer = {
    id: 'player-legacy',
    firstName: 'Legacy',
    lastName: 'Pelaaja',
    name: 'Legacy Pelaaja',
    division: 'MPO',
    pdgaNumber: '',
    pdgaRating: '',
    worldRank: '',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const updated = updatePlayer([legacyPlayer], legacyPlayer.id, {
    ...legacyPlayer,
    pdgaNumber: '5678',
  });

  assert.equal(updated.pdgaNumber, 5678);
});

test('prevents duplicate PDGA numbers', () => {
  const existingPlayer = createPlayer([], {
    firstName: 'Ensimmäinen',
    lastName: 'Pelaaja',
    division: 'MPO',
    pdgaNumber: '111',
  });

  assert.throws(
    () =>
      createPlayer([existingPlayer], {
        firstName: 'Toinen',
        lastName: 'Pelaaja',
        division: 'FPO',
        pdgaNumber: '111',
      }),
    (error) =>
      error instanceof PlayerValidationError &&
      error.fieldErrors.pdgaNumber === 'PDGA-numero on jo käytössä toisella pelaajalla.',
  );
});

test('imports players from CSV to selected division and allows empty optional fields', () => {
  const existingPlayer = createPlayer([], {
    firstName: 'Vanha',
    lastName: 'Pelaaja',
    division: 'MPO',
    pdgaNumber: '100',
  });

  const csv = 'Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking\nMatti;Meikäläinen;12345;950;1250\n;;54321;;\n';
  const { importedPlayers, summary } = importPlayersFromCsv([existingPlayer], csv, 'FPO');

  assert.equal(importedPlayers.length, 2);
  assert.equal(importedPlayers[0].division, 'FPO');
  assert.equal(importedPlayers[0].pdgaNumber, 12345);
  assert.equal(importedPlayers[0].pdgaRating, 950);
  assert.equal(importedPlayers[0].worldRank, 1250);
  assert.equal(importedPlayers[1].name, '');
  assert.equal(importedPlayers[1].pdgaRating, '');
  assert.equal(importedPlayers[1].worldRank, '');
  assert.deepEqual(summary, {
    totalRows: 2,
    importedCount: 2,
    failedCount: 0,
    failures: [],
  });
});

test('imports players CSV supports quoted values, separators and quoted line breaks', () => {
  const csv =
    '"Etunimi";"Sukunimi";"PDGA ID";"PDGA-rating";"Maailmanranking"\n"Matti;M";"Meikäläinen";"12345";"950";"1250"\n"Maija\nMaria";"Mallikas";"54321";"";""\n';
  const { importedPlayers, summary } = importPlayersFromCsv([], csv, 'MPO');

  assert.equal(importedPlayers.length, 2);
  assert.equal(importedPlayers[0].firstName, 'Matti;M');
  assert.equal(importedPlayers[1].firstName, 'Maija\nMaria');
  assert.equal(importedPlayers[0].pdgaNumber, 12345);
  assert.equal(importedPlayers[0].pdgaRating, 950);
  assert.equal(summary.failedCount, 0);
});

test('imports players CSV failure summary uses original CSV line numbers', () => {
  const csv =
    '"Etunimi";"Sukunimi";"PDGA ID";"PDGA-rating";"Maailmanranking"\n"Maija\nMaria";"Mallikas";"54321";"";""\n"Toinen";"Mallikas";"54321";"";""\n';
  const { summary } = importPlayersFromCsv([], csv, 'MPO');

  assert.equal(summary.failedCount, 1);
  assert.deepEqual(summary.failures, [{ rowNumber: 4, pdgaId: '54321', reason: 'Pelaaja löytyy jo järjestelmästä' }]);
});

test('imports players CSV reports required and integer validation errors', () => {
  const csv = 'Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking\nA;A;;900;1\nB;B;ABC123;900;1\nC;C;200;950,5;1\nD;D;201;950;1 250\n';
  const { importedPlayers, summary } = importPlayersFromCsv([], csv, 'MPO');

  assert.equal(importedPlayers.length, 0);
  assert.equal(summary.totalRows, 4);
  assert.equal(summary.importedCount, 0);
  assert.equal(summary.failedCount, 4);
  assert.deepEqual(summary.failures, [
    { rowNumber: 2, pdgaId: '', reason: 'PDGA ID puuttuu' },
    { rowNumber: 3, pdgaId: 'ABC123', reason: 'Virheellinen PDGA ID' },
    { rowNumber: 4, pdgaId: '200', reason: 'Virheellinen PDGA-rating' },
    { rowNumber: 5, pdgaId: '201', reason: 'Virheellinen maailmanranking' },
  ]);
});

test('imports players CSV reports malformed column count separately', () => {
  const csv = 'Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking\nEtu;Suku;12345;900\nEtu;Suku;12346;900;1000;ylimääräinen\n';
  const { summary } = importPlayersFromCsv([], csv, 'MPO');

  assert.equal(summary.failedCount, 2);
  assert.deepEqual(summary.failures, [
    { rowNumber: 2, pdgaId: '', reason: 'CSV-rivin sarakemäärä on virheellinen' },
    { rowNumber: 3, pdgaId: '', reason: 'CSV-rivin sarakemäärä on virheellinen' },
  ]);
});

test('imports players CSV skips duplicates in system and within file', () => {
  const existingPlayer = createPlayer([], {
    firstName: 'Olemassa',
    lastName: 'Pelaaja',
    division: 'MPO',
    pdgaNumber: '12345',
  });

  const csv = 'Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking\nMatti;Meikäläinen;12345;950;1250\nMaija;Mallikas;54321;890;2450\nToinen;Mallikas;54321;891;2451\n';
  const { importedPlayers, summary } = importPlayersFromCsv([existingPlayer], csv, 'MPO');

  assert.equal(importedPlayers.length, 1);
  assert.equal(importedPlayers[0].pdgaNumber, 54321);
  assert.equal(summary.failedCount, 2);
  assert.deepEqual(summary.failures, [
    { rowNumber: 2, pdgaId: '12345', reason: 'Pelaaja löytyy jo järjestelmästä' },
    { rowNumber: 4, pdgaId: '54321', reason: 'Pelaaja löytyy jo järjestelmästä' },
  ]);
});

test('importPlayersFromCsv requires valid division and non-empty CSV', () => {
  assert.throws(() => importPlayersFromCsv([], 'Etunimi;Sukunimi;PDGA ID;PDGA-rating;Maailmanranking\n', ''), /Valitse divisioona/);
  assert.throws(() => importPlayersFromCsv([], '\n\n', 'MPO'), /CSV-tiedostossa ei ole tuotavia pelaajarivejä/);
});

test('removes a player', () => {
  const firstPlayer = createPlayer([], {
    firstName: 'Poistettava',
    lastName: 'Pelaaja',
    division: 'MPO',
    pdgaNumber: '1111',
  });
  const secondPlayer = createPlayer([firstPlayer], {
    firstName: 'Säilyvä',
    lastName: 'Pelaaja',
    division: 'FPO',
    pdgaNumber: '2222',
  });

  const remainingPlayers = removePlayer([firstPlayer, secondPlayer], firstPlayer.id);

  assert.equal(remainingPlayers.length, 1);
  assert.equal(remainingPlayers[0].id, secondPlayer.id);
});

test('allows delete request only for the player currently being edited', () => {
  assert.equal(canRequestPlayerDeletion('player-1', 'player-1'), true);
  assert.equal(canRequestPlayerDeletion('player-2', 'player-1'), false);
  assert.equal(canRequestPlayerDeletion(null, 'player-1'), false);
});

test('sorts players by selected field and direction', () => {
  const players = [
    createPlayer([], { firstName: 'B', lastName: 'Player', division: 'MPO', pdgaNumber: '20' }),
    createPlayer([], { firstName: 'A', lastName: 'Player', division: 'MPO', pdgaNumber: '10' }),
    createPlayer([], { firstName: 'A', lastName: 'Player', division: 'MPO', pdgaNumber: '30' }),
  ];

  const byNameDesc = getVisiblePlayers(players, { sortField: 'name', sortDirection: 'desc' });
  const byPdgaAsc = getVisiblePlayers(players, { sortField: 'pdgaNumber', sortDirection: 'asc' });
  const byNameAsc = getVisiblePlayers(players, { sortField: 'name', sortDirection: 'asc' });

  assert.equal(byNameDesc[0].name, 'B Player');
  assert.equal(byPdgaAsc[0].pdgaNumber, 10);
  assert.equal(byNameAsc[0].pdgaNumber, 10);
  assert.equal(byNameAsc[1].pdgaNumber, 30);
});

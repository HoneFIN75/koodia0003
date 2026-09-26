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
} from '../js/players.js';

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

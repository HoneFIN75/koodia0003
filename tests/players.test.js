import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, updatePlayer, validatePlayerInput, removePlayer, PlayerValidationError } from '../js/players.js';

test('creates an MPO player', () => {
  const player = createPlayer([], {
    name: 'Matti Meikäläinen',
    division: 'MPO',
    pdgaNumber: '12345',
    pdgaRating: '1012',
    legacyField: 'poistuva arvo',
  });

  assert.equal(player.name, 'Matti Meikäläinen');
  assert.equal(player.division, 'MPO');
  assert.equal(player.pdgaNumber, 12345);
  assert.equal(player.pdgaRating, 1012);
  assert.ok(!Object.hasOwn(player, 'legacyField'));
});

test('creates an FPO player', () => {
  const player = createPlayer([], {
    name: 'Maija Mallikas',
    division: 'FPO',
    worldRank: '12',
  });

  assert.equal(player.name, 'Maija Mallikas');
  assert.equal(player.division, 'FPO');
  assert.equal(player.worldRank, 12);
});

test('updates a player', () => {
  const created = createPlayer([], {
    name: 'Alkuperäinen Pelaaja',
    division: 'MPO',
    pdgaNumber: '501',
  });
  const existingPlayer = { ...created, updatedAt: '2024-01-01T00:00:00.000Z' };

  const updated = updatePlayer([existingPlayer], existingPlayer.id, {
    ...existingPlayer,
    name: 'Päivitetty Pelaaja',
    division: 'FPO',
    pdgaNumber: '601',
  });

  assert.equal(updated.name, 'Päivitetty Pelaaja');
  assert.equal(updated.division, 'FPO');
  assert.equal(updated.pdgaNumber, 601);
  assert.notEqual(updated.updatedAt, existingPlayer.updatedAt);
});

test('validates required name', () => {
  assert.throws(
    () =>
      validatePlayerInput(
        {
          name: '',
          division: 'MPO',
        },
        [],
      ),
    (error) => error instanceof PlayerValidationError && error.fieldErrors.name === 'Pelaajan nimi on pakollinen.',
  );
});

test('rejects invalid PDGA number', () => {
  assert.throws(
    () =>
      validatePlayerInput(
        {
          name: 'Virheellinen Pelaaja',
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

test('prevents duplicate PDGA numbers', () => {
  const existingPlayer = createPlayer([], {
    name: 'Ensimmäinen Pelaaja',
    division: 'MPO',
    pdgaNumber: '111',
  });

  assert.throws(
    () =>
      createPlayer([existingPlayer], {
        name: 'Toinen Pelaaja',
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
    name: 'Poistettava Pelaaja',
    division: 'MPO',
  });
  const secondPlayer = createPlayer([firstPlayer], {
    name: 'Säilyvä Pelaaja',
    division: 'FPO',
  });

  const remainingPlayers = removePlayer([firstPlayer, secondPlayer], firstPlayer.id);

  assert.equal(remainingPlayers.length, 1);
  assert.equal(remainingPlayers[0].id, secondPlayer.id);
});

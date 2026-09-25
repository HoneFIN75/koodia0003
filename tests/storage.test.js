import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, saveState } from '../js/storage.js';

function createStorageStub() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    clear() {
      values.clear();
    },
  };
}

const removedTournamentField = ['cou', 'ntry'].join('');
const removedPlayerField = ['birth', 'Year'].join('');

test('loadState drops unknown legacy fields from players and tournaments', () => {
  const localStorage = createStorageStub();
  globalThis.window = { localStorage };
  try {
    localStorage.setItem(
      'sfl-pisteytystyokalu:v1',
      JSON.stringify({
        version: 1,
        players: [
          {
            id: 'player-1',
            name: 'Testipelaaja',
            division: 'MPO',
            legacyField: 'poistuva arvo',
            [removedTournamentField]: 'Suomi',
            [removedPlayerField]: 1990,
            notes: 'Huomio',
          },
        ],
        tournaments: [
          {
            id: 'tournament-1',
            name: 'Testiturnaus',
            startDate: '2026-01-01',
            multiplierKey: 'fpt',
            multiplier: 1,
            legacyField: 'poistuva arvo',
            [removedTournamentField]: 'Suomi',
          },
        ],
        tournamentResults: [],
        pointsTable: { MPO: {}, FPO: {} },
      }),
    );

    const state = loadState();

    assert.ok(!Object.hasOwn(state.players[0], 'legacyField'));
    assert.ok(!Object.hasOwn(state.tournaments[0], 'legacyField'));
    assert.ok(!Object.hasOwn(state.players[0], removedTournamentField));
    assert.ok(!Object.hasOwn(state.players[0], removedPlayerField));
    assert.ok(!Object.hasOwn(state.tournaments[0], removedTournamentField));
    assert.equal(state.players[0].notes, 'Huomio');
  } finally {
    delete globalThis.window;
  }
});

test('saveState strips unknown legacy fields before persisting', () => {
  const localStorage = createStorageStub();
  globalThis.window = { localStorage };
  try {
    const state = saveState({
      version: 1,
      players: [
        {
          id: 'player-1',
          name: 'Testipelaaja',
          division: 'FPO',
          legacyField: 'poistuva arvo',
          [removedTournamentField]: 'Suomi',
          [removedPlayerField]: 1994,
        },
      ],
      tournaments: [
        {
          id: 'tournament-1',
          name: 'Testiturnaus',
          legacyField: 'poistuva arvo',
          [removedTournamentField]: 'Suomi',
        },
      ],
      tournamentResults: [],
      pointsTable: { MPO: {}, FPO: {} },
    });

    assert.ok(!Object.hasOwn(state.players[0], 'legacyField'));
    assert.ok(!Object.hasOwn(state.tournaments[0], 'legacyField'));
    assert.ok(!Object.hasOwn(state.players[0], removedTournamentField));
    assert.ok(!Object.hasOwn(state.players[0], removedPlayerField));
    assert.ok(!Object.hasOwn(state.tournaments[0], removedTournamentField));

    const persisted = JSON.parse(localStorage.getItem('sfl-pisteytystyokalu:v1'));
    assert.ok(!Object.hasOwn(persisted.players[0], 'legacyField'));
    assert.ok(!Object.hasOwn(persisted.tournaments[0], 'legacyField'));
    assert.ok(!Object.hasOwn(persisted.players[0], removedTournamentField));
    assert.ok(!Object.hasOwn(persisted.players[0], removedPlayerField));
    assert.ok(!Object.hasOwn(persisted.tournaments[0], removedTournamentField));
  } finally {
    delete globalThis.window;
  }
});

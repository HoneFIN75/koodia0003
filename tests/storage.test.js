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
            pdgaProfileUrl: 'https://www.pdga.com/player/45678',
            notes: 'Huomio',
          },
        ],
        tournaments: [
          {
            id: 'tournament-1',
            name: 'Testiturnaus',
            externalUrl: 'https://www.pdga.com/tour/event/98765',
            startDate: '2026-01-01',
            multiplierKey: 'fpt',
            multiplier: 1,
            venue: 'Keskuspuisto',
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
    assert.ok(!Object.hasOwn(state.players[0], 'pdgaProfileUrl'));
    assert.equal(state.players[0].notes, 'Huomio');
    assert.equal(state.players[0].pdgaNumber, 45678);
    assert.equal(state.tournaments[0].pdgaEventId, 98765);
    assert.equal(state.tournaments[0].venue, 'Keskuspuisto');
    assert.equal(state.tournaments[0].displayOrder, 999);
    assert.deepEqual(state.settings, {
      playerBaseUrl: 'https://www.pdga.com/player/',
      eventBaseUrl: 'https://www.pdga.com/tour/event/',
    });
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
          pdgaProfileUrl: 'https://www.pdga.com/player/76543',
        },
      ],
      tournaments: [
        {
          id: 'tournament-1',
          name: 'Testiturnaus',
          displayOrder: 4,
          venue: 'Keskuspuisto',
          legacyField: 'poistuva arvo',
          [removedTournamentField]: 'Suomi',
          pdgaEventUrl: 'https://www.pdga.com/tour/event/321',
        },
      ],
      tournamentResults: [],
      settings: {
        playerBaseUrl: 'https://www.pdga.com/player',
        eventBaseUrl: 'https://www.pdga.com/tour/event',
      },
      pointsTable: { MPO: {}, FPO: {} },
    });

    assert.ok(!Object.hasOwn(state.players[0], 'legacyField'));
    assert.ok(!Object.hasOwn(state.tournaments[0], 'legacyField'));
    assert.ok(!Object.hasOwn(state.players[0], removedTournamentField));
    assert.ok(!Object.hasOwn(state.players[0], removedPlayerField));
    assert.ok(!Object.hasOwn(state.tournaments[0], removedTournamentField));
    assert.ok(!Object.hasOwn(state.players[0], 'pdgaProfileUrl'));
    assert.equal(state.players[0].pdgaNumber, 76543);
    assert.equal(state.tournaments[0].pdgaEventId, 321);
    assert.equal(state.tournaments[0].displayOrder, 4);
    assert.equal(state.tournaments[0].venue, 'Keskuspuisto');
    assert.deepEqual(state.settings, {
      playerBaseUrl: 'https://www.pdga.com/player/',
      eventBaseUrl: 'https://www.pdga.com/tour/event/',
    });

    const persisted = JSON.parse(localStorage.getItem('sfl-pisteytystyokalu:v2'));
    assert.ok(!Object.hasOwn(persisted.players[0], 'legacyField'));
    assert.ok(!Object.hasOwn(persisted.tournaments[0], 'legacyField'));
    assert.ok(!Object.hasOwn(persisted.players[0], removedTournamentField));
    assert.ok(!Object.hasOwn(persisted.players[0], removedPlayerField));
    assert.ok(!Object.hasOwn(persisted.tournaments[0], removedTournamentField));
    assert.ok(!Object.hasOwn(persisted.players[0], 'pdgaProfileUrl'));
    assert.equal(persisted.players[0].pdgaNumber, 76543);
    assert.equal(persisted.tournaments[0].pdgaEventId, 321);
    assert.equal(persisted.tournaments[0].displayOrder, 4);
    assert.equal(persisted.tournaments[0].venue, 'Keskuspuisto');
    assert.deepEqual(persisted.settings, {
      playerBaseUrl: 'https://www.pdga.com/player/',
      eventBaseUrl: 'https://www.pdga.com/tour/event/',
    });
  } finally {
    delete globalThis.window;
  }
});

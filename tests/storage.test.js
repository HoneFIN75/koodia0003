import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, saveState } from '../js/storage.js';

const removedTournamentField = ['cou', 'ntry'].join('');
const removedPlayerField = ['birth', 'Year'].join('');

function createJsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test('loadState sanitizes API payload and strips unknown legacy fields', async () => {
  const state = await loadState({
    moduleUrl: 'https://example.com/js/storage.js',
    fetchImpl: async (url, options) => {
      assert.equal(url.href, 'https://example.com/api/state');
      assert.equal(options.cache, 'no-store');

      return createJsonResponse({
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
        tournamentResults: [
          {
            id: 'result-1',
            tournamentId: 'tournament-1',
            playerId: 'player-1',
            place: 1,
            multiplierSnapshot: 1,
            calculatedPoints: 100,
          },
        ],
        pointsTable: { MPO: {}, FPO: {} },
      });
    },
  });

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
  assert.ok(state.tournaments[0].multiplierId);
  assert.ok(state.multipliers.length > 0);
  assert.equal(state.resultCards.length, 1);
  assert.equal(state.resultCards[0].playerId, 'player-1');
  assert.deepEqual(state.resultCards[0].results, [{ tournamentId: 'tournament-1', placement: '1' }]);
  assert.ok(!Object.hasOwn(state.resultCards[0], 'multiplier'));
  assert.ok(!Object.hasOwn(state.resultCards[0], 'tournamentId'));
  assert.deepEqual(state.settings, {
    playerBaseUrl: 'https://www.pdga.com/player/',
    eventBaseUrl: 'https://www.pdga.com/tour/event/',
    pointDecimals: 2,
  });
});

test('saveState sanitizes payload before sending it to API', async () => {
  let request;

  const state = await saveState(
    {
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
          pdgaRating: null,
          worldRank: null,
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
      resultCards: [],
      settings: {
        playerBaseUrl: 'https://www.pdga.com/player',
        eventBaseUrl: 'https://www.pdga.com/tour/event',
      },
      pointsTable: { MPO: {}, FPO: {} },
    },
    {
      moduleUrl: 'https://example.com/js/storage.js',
      fetchImpl: async (url, options) => {
        request = { url: url.href, options };
        return createJsonResponse(JSON.parse(options.body));
      },
    },
  );

  assert.equal(request.url, 'https://example.com/api/state');
  assert.equal(request.options.method, 'PUT');
  assert.equal(request.options.headers['Content-Type'], 'application/json');

  const sentState = JSON.parse(request.options.body);
  assert.ok(!Object.hasOwn(sentState.players[0], 'legacyField'));
  assert.ok(!Object.hasOwn(sentState.tournaments[0], 'legacyField'));
  assert.ok(!Object.hasOwn(sentState.players[0], removedTournamentField));
  assert.ok(!Object.hasOwn(sentState.players[0], removedPlayerField));
  assert.ok(!Object.hasOwn(sentState.tournaments[0], removedTournamentField));
  assert.ok(!Object.hasOwn(sentState.players[0], 'pdgaProfileUrl'));
  assert.equal(sentState.players[0].pdgaNumber, 76543);
  assert.equal(sentState.players[0].pdgaRating, null);
  assert.equal(sentState.players[0].worldRank, null);
  assert.equal(sentState.tournaments[0].pdgaEventId, 321);
  assert.equal(sentState.tournaments[0].displayOrder, 4);
  assert.equal(sentState.tournaments[0].venue, 'Keskuspuisto');
  assert.equal(sentState.tournaments[0].multiplierId, '');
  assert.deepEqual(sentState.settings, {
    playerBaseUrl: 'https://www.pdga.com/player/',
    eventBaseUrl: 'https://www.pdga.com/tour/event/',
    pointDecimals: 2,
  });
  assert.equal(state.players[0].pdgaNumber, 76543);
  assert.equal(state.players[0].pdgaRating, null);
  assert.equal(state.players[0].worldRank, null);
  assert.equal(state.tournaments[0].pdgaEventId, 321);
  assert.equal(state.tournaments[0].multiplierId, '');
  assert.deepEqual(state.settings, sentState.settings);
});

test('loadState migrates old tournament-based result cards to player-centric cards', async () => {
  const state = await loadState({
    fetchImpl: async () => createJsonResponse({
      version: 3,
      players: [
        { id: 'player-1', name: 'Aapo', division: 'MPO' },
        { id: 'player-2', name: 'Bertta', division: 'FPO' },
      ],
      tournaments: [
        { id: 'tournament-1', name: 'A', startDate: '2026-01-01' },
        { id: 'tournament-2', name: 'B', startDate: '2026-02-01' },
      ],
      resultCards: [
        {
          id: 'card-1',
          tournamentId: 'tournament-1',
          multiplierId: 'multiplier-1',
          status: 'FPT',
          results: [
            { playerId: 'player-1', division: 'MPO', placement: '3t2', basePoints: 80, calculatedPoints: 80 },
            { playerId: 'player-2', division: 'FPO', placement: '1', calculatedPoints: 60 },
          ],
        },
        {
          id: 'card-2',
          tournamentId: 'tournament-2',
          results: [
            { playerId: 'player-1', placement: '1' },
            { playerId: 'player-2', placement: '' },
          ],
        },
      ],
      pointsTable: { MPO: {}, FPO: {} },
    }),
  });

  assert.equal(state.version, 4);
  assert.deepEqual(
    state.resultCards.map((card) => [card.playerId, card.results]),
    [
      ['player-1', [{ tournamentId: 'tournament-1', placement: '3T2' }, { tournamentId: 'tournament-2', placement: '1' }]],
      ['player-2', [{ tournamentId: 'tournament-1', placement: '1' }]],
    ],
  );
  state.resultCards.forEach((card) => assert.ok(card.id));
});

test('loadState migrates flat legacy result rows stored in resultCards', async () => {
  const state = await loadState({
    fetchImpl: async () => createJsonResponse({
      players: [{ id: 'player-1', name: 'Aapo', division: 'MPO' }],
      tournaments: [{ id: 'tournament-1', name: 'A', startDate: '2026-01-01' }],
      resultCards: [{ id: 'result-1', tournamentId: 'tournament-1', playerId: 'player-1', place: 2, calculatedPoints: 90 }],
      pointsTable: { MPO: {}, FPO: {} },
    }),
  });

  assert.deepEqual(state.resultCards.map((card) => [card.id, card.playerId, card.results]), [
    ['result-card-player-1', 'player-1', [{ tournamentId: 'tournament-1', placement: '2' }]],
  ]);
});

test('loadState surfaces API validation message in Finnish', async () => {
  await assert.rejects(
    loadState({
      fetchImpl: async () => createJsonResponse({ message: 'Tietojen haku epäonnistui.' }, false, 500),
    }),
    /Tietojen haku epäonnistui\./,
  );
});

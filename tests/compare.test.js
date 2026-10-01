import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPARE_SEARCH_MIN_LENGTH,
  buildComparePlayerSummaries,
  buildCompareRows,
  getComparePlayers,
  searchComparePlayers,
} from '../js/compare.js';

function createState() {
  return {
    players: [
      { id: 'mpo-1', name: 'Tuomo Rikman', division: 'MPO', pdgaNumber: '12345', pdgaRating: '998', worldRank: '120' },
      { id: 'mpo-2', name: 'Tuomas Example', division: 'MPO', pdgaNumber: '12367', pdgaRating: '970', worldRank: '220' },
      { id: 'mpo-3', name: 'Leo Piironen', division: 'MPO', pdgaNumber: '54321', pdgaRating: '960', worldRank: '300' },
      { id: 'fpo-1', name: 'Eveliina Salonen', division: 'FPO', pdgaNumber: '77777' },
    ],
    tournaments: [
      { id: 't-2', name: 'Tampere Open', startDate: '2026-06-01', displayOrder: 2, multiplierId: 'multiplier-2' },
      { id: 't-1', name: 'European Open', startDate: '2026-07-17', displayOrder: 1, multiplierId: 'multiplier-1' },
      { id: 't-3', name: 'Ilman tuloksia', startDate: '2026-08-01', displayOrder: 3, multiplierId: 'multiplier-2' },
    ],
    multipliers: [
      { id: 'multiplier-1', name: 'Major', abbreviation: 'MAJ', multiplier: 2, orderNumber: 1 },
      { id: 'multiplier-2', name: 'PGPT', abbreviation: 'PGPT', multiplier: 1.5, orderNumber: 2 },
    ],
    pointsTable: {
      MPO: { 1: 100, 2: 90, 3: 80, 4: 70, 12: 20 },
      FPO: { 1: 60 },
    },
    resultCards: [
      {
        id: 'result-card-mpo-1',
        playerId: 'mpo-1',
        results: [
          { tournamentId: 't-1', placement: '4' },
          { tournamentId: 't-2', placement: '1T2' },
        ],
      },
      {
        id: 'result-card-mpo-3',
        playerId: 'mpo-3',
        results: [
          { tournamentId: 't-1', placement: '12' },
          { tournamentId: 't-2', placement: '1T2' },
        ],
      },
    ],
  };
}

test('searchComparePlayers vaatii vähintään kolme merkkiä ja hakee nimellä sekä PDGA ID:llä', () => {
  const state = createState();

  assert.equal(COMPARE_SEARCH_MIN_LENGTH, 3);
  assert.deepEqual(searchComparePlayers(state.players, 'Tu'), []);
  assert.deepEqual(
    searchComparePlayers(state.players, 'Tuo').map((player) => player.name),
    ['Tuomas Example', 'Tuomo Rikman'],
  );
  assert.deepEqual(
    searchComparePlayers(state.players, '123').map((player) => player.pdgaNumber),
    ['12367', '12345'],
  );
});

test('searchComparePlayers jättää jo valitut pelaajat pois ja rajaa ehdotusten määrää', () => {
  const state = createState();

  assert.deepEqual(
    searchComparePlayers(state.players, 'Tuo', { selectedPlayerIds: ['mpo-2'] }).map((player) => player.id),
    ['mpo-1'],
  );
  assert.equal(searchComparePlayers(state.players, 'Tuo', { limit: 1 }).length, 1);
});

test('getComparePlayers säilyttää valintajärjestyksen ja ohittaa tuntemattomat pelaajat', () => {
  const state = createState();

  assert.deepEqual(
    getComparePlayers(state.players, ['mpo-3', 'puuttuva', 'mpo-1']).map((player) => player.id),
    ['mpo-3', 'mpo-1'],
  );
});

test('buildComparePlayerSummaries kokoaa ratingin, rankingin, pisteet ja turnausmäärän kerran', () => {
  const state = createState();
  const summaries = buildComparePlayerSummaries(state, ['mpo-1', 'mpo-3']);

  assert.deepEqual(summaries.map((summary) => summary.id), ['mpo-1', 'mpo-3']);
  assert.equal(summaries[0].pdgaRating, '998');
  assert.equal(summaries[0].worldRank, '120');
  assert.equal(summaries[0].tournamentCount, 2);
  // 4. sija European Openissa (70 × 2) ja jaettu 1T2 Tampere Openissa ((100 + 90) / 2 × 1,5).
  assert.equal(summaries[0].totalPoints, 282.5);
  assert.equal(summaries[1].totalPoints, 182.5);
});

test('buildCompareRows järjestää turnaukset kuten Turnaukset-sivu ja näyttää sijoitukset sellaisenaan', () => {
  const state = createState();
  const rows = buildCompareRows(state, ['mpo-1', 'mpo-3']);

  assert.deepEqual(rows.map((row) => row.tournament.id), ['t-1', 't-2', 't-3']);
  assert.equal(rows[0].multiplier.abbreviation, 'MAJ');
  assert.deepEqual(rows[0].placements.map((entry) => entry.placement), ['4', '12']);
  assert.deepEqual(rows[1].placements.map((entry) => entry.placement), ['1T2', '1T2']);
  assert.deepEqual(rows[2].placements.map((entry) => entry.placement), ['', '']);
  assert.deepEqual(rows.map((row) => row.hasResults), [true, true, false]);
});

test('buildCompareRows korostaa parhaan sijoituksen ja kaikki tasatulokset', () => {
  const state = createState();
  const rows = buildCompareRows(state, ['mpo-1', 'mpo-3']);

  assert.deepEqual(rows[0].placements.map((entry) => entry.isBest), [true, false]);
  assert.deepEqual(rows[1].placements.map((entry) => entry.isBest), [true, true]);
  assert.deepEqual(rows[2].placements.map((entry) => entry.isBest), [false, false]);
});

test('buildCompareRows piilottaa pyydettäessä turnaukset ilman yhtään tulosta', () => {
  const state = createState();

  assert.deepEqual(
    buildCompareRows(state, ['mpo-1', 'mpo-3'], { hideEmptyTournaments: true }).map((row) => row.tournament.id),
    ['t-1', 't-2'],
  );
  assert.deepEqual(
    buildCompareRows(state, ['mpo-2'], { hideEmptyTournaments: true }),
    [],
  );
});

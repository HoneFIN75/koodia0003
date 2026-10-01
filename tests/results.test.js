import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlayerResultCardRows,
  buildTournamentStandings,
  getPlacementMedal,
  clearAllResults,
  clearPlayerPlacement,
  countResults,
  formatBestResult,
  getBestTournamentResults,
  getPlayerPlacement,
  removePlayerResultCard,
  removeTournamentFromResultCards,
  setPlayerPlacement,
} from '../js/results.js';
import { buildRanking } from '../js/ranking.js';

const NOW = '2026-09-30T12:00:00.000Z';

function createState() {
  return {
    players: [
      { id: 'mpo-1', name: 'Niklas Anttila', division: 'MPO' },
      { id: 'mpo-2', name: 'Aapo Aalto', division: 'MPO' },
      { id: 'mpo-3', name: 'Bertil Berg', division: 'MPO' },
      { id: 'fpo-1', name: 'Eveliina Salonen', division: 'FPO' },
    ],
    tournaments: [
      { id: 't-2', name: 'Tampere Open', startDate: '2026-06-01', displayOrder: 2, multiplierId: 'multiplier-2' },
      { id: 't-1', name: 'European Open', startDate: '2026-07-17', displayOrder: 1, multiplierId: 'multiplier-1' },
      { id: 't-3', name: 'Ilman kerrointa', startDate: '2026-08-01', displayOrder: 3, multiplierId: '' },
    ],
    multipliers: [
      { id: 'multiplier-1', status: 'MAJ', multiplier: 2, sortOrder: 1 },
      { id: 'multiplier-2', status: 'FPT', multiplier: 1, sortOrder: 2 },
    ],
    pointsTable: {
      MPO: { 1: 100, 2: 90, 3: 80, 4: 70, 5: 60 },
      FPO: { 1: 60, 2: 50 },
    },
    resultCards: [],
  };
}

function apply(state, input) {
  const result = setPlayerPlacement(state, { now: NOW, ...input });
  state.resultCards = result.resultCards;
  return result;
}

test('setPlayerPlacement tallentaa vain sijoituksen ja palauttaa lasketut pisteet', () => {
  const state = createState();
  const result = apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: ' 1 ' });

  assert.equal(result.changed, true);
  assert.equal(result.placement, '1');
  assert.equal(result.points, 200);
  assert.deepEqual(state.resultCards, [{
    id: 'result-card-mpo-1',
    playerId: 'mpo-1',
    createdAt: NOW,
    updatedAt: NOW,
    results: [{ tournamentId: 't-1', placement: '1' }],
  }]);

  const unchanged = apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: '1' });
  assert.equal(unchanged.changed, false);
});

test('setPlayerPlacement käyttää sarjan omaa pistetaulukkoa ja hylkää puuttuvan arvon', () => {
  const state = createState();
  assert.equal(apply(state, { playerId: 'fpo-1', tournamentId: 't-1', placement: '1' }).points, 120);

  assert.throws(
    () => apply(state, { playerId: 'fpo-1', tournamentId: 't-2', placement: '3' }),
    /Pisteitä ei ole määritetty sarjalle FPO sijoitukselle 3/,
  );
  assert.equal(getPlayerPlacement(state.resultCards, 'fpo-1', 't-2'), '');

  assert.throws(
    () => apply(state, { playerId: 'mpo-1', tournamentId: 't-3', placement: '1' }),
    /kerrointa ei löytynyt/,
  );
  assert.throws(() => apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: 'abc' }));
});

test('setPlayerPlacement tukee tasatuloksia ja validoi ne saman sarjan pelaajia vasten', () => {
  const state = createState();
  assert.equal(apply(state, { playerId: 'mpo-1', tournamentId: 't-2', placement: '2t2' }).points, 85);
  assert.equal(apply(state, { playerId: 'mpo-2', tournamentId: 't-2', placement: '2T2' }).points, 85);
  assert.equal(getPlayerPlacement(state.resultCards, 'mpo-1', 't-2'), '2T2');

  assert.throws(
    () => apply(state, { playerId: 'mpo-3', tournamentId: 't-2', placement: '2T2' }),
    /liikaa pelaajia/,
  );
  assert.throws(
    () => apply(state, { playerId: 'mpo-3', tournamentId: 't-2', placement: '3' }),
    /menee päällekkäin/,
  );

  // Eri sarjan pelaaja voi käyttää samaa sijoitusta.
  assert.equal(apply(state, { playerId: 'fpo-1', tournamentId: 't-2', placement: '2' }).points, 50);
});

test('tyhjä syöte ja clearPlayerPlacement poistavat sijoituksen', () => {
  const state = createState();
  apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: '1' });
  apply(state, { playerId: 'mpo-1', tournamentId: 't-2', placement: '2' });

  const cleared = apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: '' });
  assert.equal(cleared.changed, true);
  assert.equal(getPlayerPlacement(state.resultCards, 'mpo-1', 't-1'), '');

  state.resultCards = clearPlayerPlacement(state.resultCards, 'mpo-1', 't-2', NOW);
  assert.equal(countResults(state.resultCards, { playerId: 'mpo-1' }), 0);
  assert.equal(buildRanking(state, 'MPO')[0].totalPoints, 0);
});

test('turnauksen tai pelaajan poisto poistaa niihin liittyvät sijoitukset', () => {
  const state = createState();
  apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: '1' });
  apply(state, { playerId: 'mpo-1', tournamentId: 't-2', placement: '1' });
  apply(state, { playerId: 'fpo-1', tournamentId: 't-1', placement: '1' });

  assert.equal(countResults(state.resultCards), 3);
  assert.equal(countResults(state.resultCards, { tournamentId: 't-1' }), 2);
  assert.equal(countResults(removeTournamentFromResultCards(state.resultCards, 't-1')), 1);
  assert.equal(countResults(removePlayerResultCard(state.resultCards, 'mpo-1')), 1);
});

test('clearAllResults tyhjentää sijoitukset muuttamatta muita tietoja ja nollaa lasketut pisteet', () => {
  const state = createState();
  state.players[0].pdgaRating = 1000;
  state.players[0].worldRank = 5;
  state.settings = { playerBaseUrl: 'https://www.pdga.com/player', playerFetchTimeoutMs: 5000 };
  state.rankings = { activeDivision: 'MPO', sortOrder: 'desc' };
  apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: '1' });
  apply(state, { playerId: 'mpo-1', tournamentId: 't-2', placement: '2T2' });
  apply(state, { playerId: 'fpo-1', tournamentId: 't-1', placement: '1' });

  const expectedPreservedState = { ...state, resultCards: [] };
  const cleared = clearAllResults(state);

  assert.notEqual(cleared, state);
  assert.deepEqual(cleared, expectedPreservedState);
  assert.deepEqual(cleared.resultCards, []);
  assert.deepEqual(
    buildRanking(cleared)
      .map((player) => [player.id, player.totalPoints, player.tournamentCount])
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    state.players
      .map((player) => [player.id, 0, 0])
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
  );
  assert.deepEqual(buildPlayerResultCardRows(cleared, 'mpo-1').map((row) => [row.placement, row.calculatedPoints]), [
    ['', null],
    ['', null],
    ['', null],
  ]);
});

test('getBestTournamentResults näyttää parhaan MPO- ja FPO-sijoituksen', () => {
  const state = createState();
  assert.equal(formatBestResult(getBestTournamentResults(state, 't-1').MPO), '-');

  apply(state, { playerId: 'mpo-2', tournamentId: 't-1', placement: '3' });
  apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: '1' });
  apply(state, { playerId: 'fpo-1', tournamentId: 't-1', placement: '1' });
  apply(state, { playerId: 'mpo-2', tournamentId: 't-2', placement: '1T2' });
  apply(state, { playerId: 'mpo-3', tournamentId: 't-2', placement: '1T2' });

  const best = getBestTournamentResults(state, 't-1');
  assert.equal(formatBestResult(best.MPO), '1 Niklas Anttila');
  assert.equal(formatBestResult(best.FPO), '1 Eveliina Salonen');

  const tied = getBestTournamentResults(state, 't-2');
  assert.equal(formatBestResult(tied.MPO), '1T2 Aapo Aalto, Bertil Berg');
  assert.equal(formatBestResult(tied.FPO), '-');
});

test('buildPlayerResultCardRows listaa turnaukset järjestysnumeron mukaan ja laskee pisteet dynaamisesti', () => {
  const state = createState();
  apply(state, { playerId: 'mpo-1', tournamentId: 't-1', placement: '2' });

  let rows = buildPlayerResultCardRows(state, 'mpo-1');
  assert.deepEqual(rows.map((row) => row.tournament.id), ['t-1', 't-2', 't-3']);
  assert.deepEqual(rows.map((row) => [row.placement, row.calculatedPoints]), [['2', 180], ['', null], ['', null]]);

  state.pointsTable.MPO[2] = 95;
  state.multipliers[0].multiplier = 3;
  rows = buildPlayerResultCardRows(state, 'mpo-1');
  assert.equal(rows[0].calculatedPoints, 285);
  assert.equal(buildRanking(state, 'MPO')[0].totalPoints, 285);
});

function createStandingsState(resultCards) {
  return {
    players: [
      { id: 'm1', name: 'Niklas Anttila', division: 'MPO' },
      { id: 'm2', name: 'Jesse Nieminen', division: 'MPO' },
      { id: 'm3', name: 'Väinö Mäkelä', division: 'MPO' },
      { id: 'm4', name: 'Teemu Lampainen', division: 'MPO' },
      { id: 'm5', name: 'Aki Seppälä', division: 'MPO' },
      { id: 'f1', name: 'Eveliina Salonen', division: 'FPO' },
    ],
    resultCards,
  };
}

test('getPlacementMedal käyttää näytetyn sijoituksen ensimmäistä numeroa', () => {
  assert.equal(getPlacementMedal('1'), 'gold');
  assert.equal(getPlacementMedal('1T2'), 'gold');
  assert.equal(getPlacementMedal('2T2'), 'silver');
  assert.equal(getPlacementMedal('3T4'), 'bronze');
  assert.equal(getPlacementMedal('4'), null);
  assert.equal(getPlacementMedal('10T3'), null);
  assert.equal(getPlacementMedal(''), null);
  assert.equal(getPlacementMedal('virhe'), null);
});

test('buildTournamentStandings lajittelee kilpailujärjestykseen ja jättää tyhjät sarjat pois', () => {
  const state = createStandingsState([
    { playerId: 'm5', results: [{ tournamentId: 't1', placement: '7' }] },
    { playerId: 'm3', results: [{ tournamentId: 't1', placement: '3T4' }] },
    { playerId: 'm2', results: [{ tournamentId: 't1', placement: '2' }, { tournamentId: 't2', placement: '1' }] },
    { playerId: 'm4', results: [{ tournamentId: 't1', placement: '3T4' }] },
    { playerId: 'm1', results: [{ tournamentId: 't1', placement: '1' }] },
    { playerId: 'missing', results: [{ tournamentId: 't1', placement: '4' }] },
  ]);

  const standings = buildTournamentStandings(state, 't1');
  assert.deepEqual(standings.map((entry) => entry.division), ['MPO']);
  assert.deepEqual(
    standings[0].rows.map((row) => [row.placement, row.name, row.medal]),
    [
      ['1', 'Niklas Anttila', 'gold'],
      ['2', 'Jesse Nieminen', 'silver'],
      ['3T4', 'Teemu Lampainen', 'bronze'],
      ['3T4', 'Väinö Mäkelä', 'bronze'],
      ['7', 'Aki Seppälä', null],
    ],
  );
});

test('buildTournamentStandings näyttää FPO:n yksin ja molemmat sarjat järjestyksessä MPO, FPO', () => {
  const onlyFpo = createStandingsState([{ playerId: 'f1', results: [{ tournamentId: 't1', placement: '1' }] }]);
  assert.deepEqual(buildTournamentStandings(onlyFpo, 't1').map((entry) => entry.division), ['FPO']);

  const both = createStandingsState([
    { playerId: 'f1', results: [{ tournamentId: 't1', placement: '1' }] },
    { playerId: 'm1', results: [{ tournamentId: 't1', placement: '1' }] },
  ]);
  assert.deepEqual(buildTournamentStandings(both, 't1').map((entry) => entry.division), ['MPO', 'FPO']);
  assert.deepEqual(buildTournamentStandings(both, 'tyhja'), []);
});

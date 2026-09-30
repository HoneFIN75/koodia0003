import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyPointsTable,
  upsertPointsTableEntry,
  clearPointsTableDivision,
  calculatePoints,
  importPointsTableDivision,
  listPointsTableEntries,
  parsePointsTableCsv,
  parsePlacement,
  calculatePlacementPoints,
  validatePlacementAgainstOthers,
  calculateResultPoints,
  tryCalculateResultPoints,
  calculateAllResultPoints,
} from '../js/scoring.js';
import { buildRanking, getPlayerResults, getTopRanking } from '../js/ranking.js';

const TEST_MULTIPLIERS = [
  { id: 'multiplier-1', multiplier: 1 },
  { id: 'multiplier-2', multiplier: 2 },
];

test('calculatePoints multiplies base points with multiplier', () => {
  assert.equal(calculatePoints({ basePoints: 25, multiplier: 4 }), 100);
  assert.equal(calculatePoints({ basePoints: 12.5, multiplier: 0.5 }), 6.25);
});

test('calculatePlacementPoints throws when points table entry is missing', () => {
  assert.throws(
    () => calculatePlacementPoints({ placement: '1', division: 'MPO', pointsTable: createEmptyPointsTable(), multiplier: 4 }),
    /Pisteitä ei ole määritetty sarjalle MPO sijoitukselle 1/,
  );
});

test('validation throws for invalid placement and multiplier', () => {
  assert.throws(() => calculatePoints({ basePoints: 10, multiplier: 0 }), /Kertoimen pitää olla nollaa suurempi/);
  assert.throws(() => parsePlacement('0'), /Sijoituksen muoto on virheellinen/);
});

test('parsePointsTableCsv accepts header row and Finnish decimal commas', () => {
  const entries = parsePointsTableCsv('Sijoitus;Pisteet\n1;100\n2;10,5\n3;7,25\n');

  assert.deepEqual(entries, [
    { place: 1, basePoints: 100 },
    { place: 2, basePoints: 10.5 },
    { place: 3, basePoints: 7.25 },
  ]);
});

test('parsePointsTableCsv accepts quoted semicolon-delimited values', () => {
  const entries = parsePointsTableCsv('"Sijoitus";"Pisteet"\n"1";"100"\n"2";"10,5"\n');

  assert.deepEqual(entries, [
    { place: 1, basePoints: 100 },
    { place: 2, basePoints: 10.5 },
  ]);
});

test('parsePointsTableCsv rejects gaps in placements', () => {
  assert.throws(
    () => parsePointsTableCsv('1;100\n2;85\n4;75\n'),
    /Sijoitusnumeroiden tulee olla peräkkäisiä ilman aukkoja\. Puuttuva sijoitus: 3/,
  );
});

test('parsePointsTableCsv rejects line breaks inside quoted fields', () => {
  assert.throws(
    () => parsePointsTableCsv('"Sijoitus";"Pisteet"\n"1";"10,\n5"\n'),
    /CSV-tiedoston tietueet eivät saa sisältää rivinvaihtoja lainausmerkkien sisällä\./,
  );
});

test('parsePointsTableCsv rejects duplicate placements and missing points', () => {
  assert.throws(
    () => parsePointsTableCsv('1;100\n1;90\n'),
    /Sijoitusnumeroiden tulee olla uniikkeja\. Päällekkäinen sijoitus: 1/,
  );

  assert.throws(
    () => parsePointsTableCsv('1;\n'),
    /CSV-riviltä 1 puuttuu pistearvo\./,
  );
});

test('points table division can be imported and cleared', () => {
  let pointsTable = createEmptyPointsTable();
  pointsTable = importPointsTableDivision(pointsTable, 'MPO', [
    { place: 1, basePoints: 100 },
    { place: 2, basePoints: 10.5 },
  ]);

  assert.deepEqual(listPointsTableEntries(pointsTable, 'MPO'), [
    { division: 'MPO', place: 1, basePoints: 100 },
    { division: 'MPO', place: 2, basePoints: 10.5 },
  ]);

  const cleared = clearPointsTableDivision(pointsTable, 'MPO');
  assert.deepEqual(listPointsTableEntries(cleared, 'MPO'), []);
  assert.deepEqual(listPointsTableEntries(cleared, 'FPO'), []);
});

test('parsePlacement accepts normal and tie formats and rejects invalid values', () => {
  assert.deepEqual(parsePlacement('1'), {
    raw: '1',
    place: 1,
    tieCount: 1,
    isTie: false,
    rangeStart: 1,
    rangeEnd: 1,
  });
  assert.deepEqual(parsePlacement('3t4'), {
    raw: '3T4',
    place: 3,
    tieCount: 4,
    isTie: true,
    rangeStart: 3,
    rangeEnd: 6,
  });

  assert.throws(() => parsePlacement('T4'), /Sijoituksen muoto on virheellinen/);
  assert.throws(() => parsePlacement('3T'), /Sijoituksen muoto on virheellinen/);
  assert.throws(() => parsePlacement('3TT4'), /Sijoituksen muoto on virheellinen/);
  assert.throws(() => parsePlacement('3-T-4'), /Sijoituksen muoto on virheellinen/);
  assert.throws(() => parsePlacement('ABC'), /Sijoituksen muoto on virheellinen/);
});

test('calculatePlacementPoints averages tie placements before multiplier', () => {
  const pointsTable = {
    MPO: {
      3: 75,
      4: 65,
      5: 55,
      6: 45,
    },
    FPO: {},
  };

  assert.equal(calculatePlacementPoints({
    placement: '3T4',
    division: 'MPO',
    pointsTable,
    multiplier: 2,
  }), 120);
});

test('validatePlacementAgainstOthers hylkää päällekkäiset sijoitukset paitsi saman tasatuloksen', () => {
  assert.throws(() => validatePlacementAgainstOthers({
    placement: '4',
    others: [{ playerId: 'player-1', name: 'Aapo', placement: '3T4' }],
  }), /menee päällekkäin pelaajan Aapo sijoituksen 3T4 kanssa/);

  assert.equal(validatePlacementAgainstOthers({
    placement: '3T2',
    others: [{ playerId: 'player-1', placement: '3T2' }, { playerId: 'player-2', placement: '1' }],
  }).raw, '3T2');

  assert.equal(validatePlacementAgainstOthers({ placement: '100T10', others: [] }).rangeEnd, 109);
  assert.equal(validatePlacementAgainstOthers({ placement: '', others: [] }), null);
});

test('validatePlacementAgainstOthers hylkää tasatuloksen, jos pelaajia on enemmän kuin tieCount', () => {
  assert.throws(() => validatePlacementAgainstOthers({
    placement: '3T2',
    others: [{ playerId: 'player-1', placement: '3T2' }, { playerId: 'player-2', placement: '3T2' }],
  }), /liikaa pelaajia/);
});

test('calculatePlacementPoints hylkää tasatuloksen jos jokin sijoituksen piste puuttuu', () => {
  const pointsTable = {
    MPO: { 3: 75, 4: 65, 6: 45 },
    FPO: {},
  };

  assert.throws(() => calculatePlacementPoints({
    placement: '3T4',
    division: 'MPO',
    pointsTable,
    multiplier: 2,
  }), /Pisteitä ei ole määritetty sarjalle MPO sijoitukselle 5/);
});

test('calculateResultPoints käyttää pelaajan sarjan pistetaulukkoa ja turnauksen kerrointa', () => {
  const pointsTable = { MPO: { 1: 100, 2: 85, 3: 75, 4: 65 }, FPO: { 1: 60, 2: 50 } };
  const tournament = { id: 't-1', multiplierId: 'multiplier-2' };
  const mpo = { id: 'p-1', division: 'MPO' };
  const fpo = { id: 'p-2', division: 'FPO' };

  assert.equal(calculateResultPoints({ placement: '1', player: mpo, tournament, pointsTable, multipliers: TEST_MULTIPLIERS }), 200);
  assert.equal(calculateResultPoints({ placement: '1', player: fpo, tournament, pointsTable, multipliers: TEST_MULTIPLIERS }), 120);
  assert.equal(calculateResultPoints({ placement: '3T2', player: mpo, tournament, pointsTable, multipliers: TEST_MULTIPLIERS }), 140);

  assert.throws(() => calculateResultPoints({
    placement: '3',
    player: fpo,
    tournament,
    pointsTable,
    multipliers: TEST_MULTIPLIERS,
  }), /Pisteitä ei ole määritetty sarjalle FPO sijoitukselle 3/);
  assert.throws(() => calculateResultPoints({
    placement: '1',
    player: mpo,
    tournament: { id: 't-2', multiplierId: '' },
    pointsTable,
    multipliers: TEST_MULTIPLIERS,
  }), /kerrointa ei löytynyt/);
  assert.equal(tryCalculateResultPoints({ placement: '3', player: fpo, tournament, pointsTable, multipliers: TEST_MULTIPLIERS }), null);
});

function createChainState() {
  return {
    players: [
      { id: 'mpo-1', name: 'Aapo MPO', division: 'MPO' },
      { id: 'mpo-2', name: 'Bertta MPO', division: 'MPO' },
      { id: 'fpo-1', name: 'Cecilia FPO', division: 'FPO' },
    ],
    tournaments: [
      { id: 't-1', name: 'A', startDate: '2026-05-01', multiplierId: 'multiplier-1' },
      { id: 't-2', name: 'B', startDate: '2026-06-01', multiplierId: 'multiplier-2' },
    ],
    multipliers: TEST_MULTIPLIERS.map((entry) => ({ ...entry })),
    pointsTable: {
      MPO: { 1: 100, 2: 95, 3: 85 },
      FPO: { 1: 60, 2: 50 },
    },
    resultCards: [
      {
        id: 'result-card-mpo-1',
        playerId: 'mpo-1',
        results: [
          { tournamentId: 't-1', placement: '1' },
          { tournamentId: 't-2', placement: '3' },
        ],
      },
      {
        id: 'result-card-mpo-2',
        playerId: 'mpo-2',
        results: [
          { tournamentId: 't-1', placement: '2' },
          { tournamentId: 't-2', placement: '' },
        ],
      },
      {
        id: 'result-card-fpo-1',
        playerId: 'fpo-1',
        results: [
          { tournamentId: 't-1', placement: '1' },
          { tournamentId: 't-2', placement: '2' },
        ],
      },
    ],
  };
}

test('kokonaispisteet lasketaan pelaajan tuloskortista sarjan pistetaulukolla ja turnauksen kertoimella', () => {
  const state = createChainState();
  const ranking = buildRanking(state, 'ALL');

  assert.deepEqual(
    ranking.map((entry) => [entry.id, entry.totalPoints, entry.tournamentCount]),
    [
      ['mpo-1', 100 + 85 * 2, 2],
      ['fpo-1', 60 + 50 * 2, 2],
      ['mpo-2', 95, 1],
    ],
  );
  assert.deepEqual(buildRanking(state, 'MPO').map((entry) => entry.id), ['mpo-1', 'mpo-2']);
  assert.deepEqual(buildRanking(state, 'FPO').map((entry) => entry.id), ['fpo-1']);
  assert.equal(getTopRanking(buildRanking(state, 'MPO'), 1)[0].totalPoints, 270);
  assert.deepEqual(getPlayerResults(state, 'mpo-1').map((result) => result.calculatedPoints), [170, 100]);
});

test('ranking päivittyy automaattisesti, kun sijoitus, pistetaulukko tai kerroin muuttuu', () => {
  const state = createChainState();

  state.resultCards[1].results[1].placement = '1';
  state.resultCards[0].results[1].placement = '2';
  assert.deepEqual(buildRanking(state, 'MPO').map((entry) => [entry.id, entry.totalPoints]), [
    ['mpo-2', 95 + 100 * 2],
    ['mpo-1', 100 + 95 * 2],
  ]);

  state.pointsTable.MPO[2] = 120;
  assert.deepEqual(buildRanking(state, 'MPO').map((entry) => [entry.id, entry.totalPoints]), [
    ['mpo-1', 100 + 120 * 2],
    ['mpo-2', 120 + 100 * 2],
  ]);

  state.multipliers[1].multiplier = 3;
  assert.equal(buildRanking(state, 'MPO')[0].totalPoints, 100 + 120 * 3);

  state.tournaments[1].multiplierId = 'multiplier-1';
  assert.equal(buildRanking(state, 'MPO')[0].totalPoints, 100 + 120);
});

test('calculateAllResultPoints laskee tasatuloksen ja ohittaa laskemattomat sijoitukset', () => {
  const state = createChainState();
  state.resultCards[0].results[0].placement = '1T2';
  state.resultCards[1].results[0].placement = '1T2';
  state.resultCards[2].results[0].placement = '5';

  const allResults = calculateAllResultPoints(state);
  assert.ok(allResults.every((result) => Number.isFinite(result.calculatedPoints)));
  assert.deepEqual(
    allResults.filter((result) => result.tournamentId === 't-1').map((result) => [result.playerId, result.calculatedPoints]),
    [['mpo-1', 97.5], ['mpo-2', 97.5]],
  );
  assert.ok(state.resultCards.every((card) => card.results.every((result) => !Object.hasOwn(result, 'calculatedPoints'))));
});

test('tuloskortin mahdollisia tallennettuja pisteitä tai kerroinsnapshotia ei käytetä laskennassa', () => {
  const state = createChainState();
  state.resultCards[0].multiplier = 10;
  state.resultCards[0].results[0].calculatedPoints = 9999;
  state.resultCards[0].results[0].basePoints = 9999;

  assert.equal(buildRanking(state, 'MPO')[0].totalPoints, 100 + 85 * 2);
});

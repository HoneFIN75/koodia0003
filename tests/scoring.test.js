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
  recalculateResultCard,
  calculateResultCardPoints,
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

test('recalculateResultCard rejects overlapping placements unless same tie notation', () => {
  const pointsTable = {
    MPO: { 1: 100, 2: 85, 3: 75, 4: 65, 5: 55, 6: 45 },
    FPO: {},
  };
  const card = {
    id: 'card-1',
    tournamentId: 'tournament-1',
    multiplierId: 'multiplier-1',
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '3T4' },
      { playerId: 'player-2', division: 'MPO', placement: '4' },
    ],
  };

  assert.throws(() => recalculateResultCard({
    card,
    players: [],
    pointsTable,
    multipliers: TEST_MULTIPLIERS,
  }), /Sijoitukset menevät päällekkäin/);
});

test('recalculateResultCard laskee sekä normaalin sijoituksen että tasatuloksen oikein', () => {
  const pointsTable = {
    MPO: { 1: 100, 2: 85, 3: 75, 4: 65 },
    FPO: {},
  };
  const card = {
    id: 'card-1',
    tournamentId: 'tournament-1',
    multiplierId: 'multiplier-2',
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '1' },
      { playerId: 'player-2', division: 'MPO', placement: '3T2' },
      { playerId: 'player-3', division: 'MPO', placement: '3T2' },
    ],
  };

  const recalculated = recalculateResultCard({
    card,
    players: [],
    pointsTable,
    multipliers: TEST_MULTIPLIERS,
  });

  assert.equal(recalculated[0].calculatedPoints, 200);
  assert.equal(recalculated[1].calculatedPoints, 140);
  assert.equal(recalculated[2].calculatedPoints, 140);
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

test('recalculateResultCard hylkää tasatuloksen jos rivejä on enemmän kuin tieCount', () => {
  const pointsTable = {
    MPO: { 3: 75, 4: 65 },
    FPO: {},
  };
  const card = {
    id: 'card-1',
    tournamentId: 'tournament-1',
    multiplierId: 'multiplier-1',
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '3T2' },
      { playerId: 'player-2', division: 'MPO', placement: '3T2' },
      { playerId: 'player-3', division: 'MPO', placement: '3T2' },
    ],
  };

  assert.throws(() => recalculateResultCard({
    card,
    players: [],
    pointsTable,
    multipliers: TEST_MULTIPLIERS,
  }), /liikaa rivejä/);
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
        id: 'card-1',
        tournamentId: 't-1',
        multiplierId: 'multiplier-1',
        results: [
          { playerId: 'mpo-1', division: 'MPO', placement: '1' },
          { playerId: 'mpo-2', division: 'MPO', placement: '2' },
          { playerId: 'fpo-1', division: 'FPO', placement: '1' },
        ],
      },
      {
        id: 'card-2',
        tournamentId: 't-2',
        multiplierId: 'multiplier-2',
        results: [
          { playerId: 'mpo-1', division: 'MPO', placement: '3' },
          { playerId: 'mpo-2', division: 'MPO', placement: '' },
          { playerId: 'fpo-1', division: 'FPO', placement: '2' },
        ],
      },
    ],
  };
}

test('kokonaispisteet lasketaan tuloksista sarjan pistetaulukolla ja turnauksen kertoimella', () => {
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
  state.resultCards[1].results[0].placement = '2';
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

test('calculateResultCardPoints laskee tasatuloksen ja jättää puuttuvat pisteet laskematta', () => {
  const state = createChainState();
  state.resultCards[0].results = [
    { playerId: 'mpo-1', division: 'MPO', placement: '1T2' },
    { playerId: 'mpo-2', division: 'MPO', placement: '1T2' },
    { playerId: 'fpo-1', division: 'FPO', placement: '5' },
  ];

  const results = calculateResultCardPoints({ ...state, card: state.resultCards[0] });
  assert.deepEqual(results.map((result) => result.calculatedPoints), [97.5, 97.5, null]);
  assert.ok(state.resultCards[0].results.every((result) => !Object.hasOwn(result, 'calculatedPoints')));

  const allResults = calculateAllResultPoints(state);
  assert.ok(allResults.every((result) => Number.isFinite(result.calculatedPoints)));
  assert.equal(allResults.filter((result) => result.cardId === 'card-1').length, 2);
});

test('tuloskortin tallennettuja pisteitä tai kerroinsnapshotia ei käytetä laskennassa', () => {
  const state = createChainState();
  state.resultCards[0].multiplier = 10;
  state.resultCards[0].results[0].calculatedPoints = 9999;

  assert.equal(buildRanking(state, 'MPO')[0].totalPoints, 100 + 85 * 2);
});

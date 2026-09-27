import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyPointsTable,
  upsertPointsTableEntry,
  clearPointsTableDivision,
  calculatePoints,
  createTournamentResult,
  importPointsTableDivision,
  listPointsTableEntries,
  parsePointsTableCsv,
  parsePlacement,
  calculatePlacementPoints,
  recalculateResultCard,
  updateTournamentResult,
} from '../js/scoring.js';

test('calculatePoints multiplies base points with multiplier', () => {
  assert.equal(calculatePoints({ basePoints: 25, multiplier: 4 }), 100);
  assert.equal(calculatePoints({ basePoints: 12.5, multiplier: 0.5 }), 6.25);
});

test('createTournamentResult throws when points table entry is missing', () => {
  const pointsTable = createEmptyPointsTable();

  assert.throws(
    () =>
      createTournamentResult({
        tournamentId: 't-1',
        playerId: 'p-1',
        place: 1,
        division: 'MPO',
        pointsTable,
        multiplier: 4,
        existingResults: [],
      }),
    /Pisteitä ei ole määritetty sarjalle MPO sijoitukselle 1/,
  );
});

test('validation throws for invalid place and multiplier', () => {
  assert.throws(() => calculatePoints({ basePoints: 10, multiplier: 0 }), /Kertoimen pitää olla nollaa suurempi/);

  assert.throws(
    () =>
      createTournamentResult({
        tournamentId: 't-1',
        playerId: 'p-1',
        place: 0,
        division: 'MPO',
        pointsTable: createEmptyPointsTable(),
        multiplier: 1,
        existingResults: [],
      }),
    /Sijoituksen pitää olla positiivinen kokonaisluku/,
  );
});

test('create and update tournament result stores snapshot values', () => {
  let pointsTable = createEmptyPointsTable();
  pointsTable = upsertPointsTableEntry(pointsTable, { division: 'MPO', place: 1, basePoints: 20 });
  pointsTable = upsertPointsTableEntry(pointsTable, { division: 'MPO', place: 2, basePoints: 10 });

  const created = createTournamentResult({
    tournamentId: 't-1',
    playerId: 'p-1',
    place: 1,
    division: 'MPO',
    pointsTable,
    multiplier: 3,
    existingResults: [],
  });

  test('createTournamentResult resolves multiplier from tournament reference', () => {
    let pointsTable = createEmptyPointsTable();
    pointsTable = upsertPointsTableEntry(pointsTable, { division: 'MPO', place: 1, basePoints: 20 });

    const result = createTournamentResult({
      tournamentId: 't-1',
      playerId: 'p-1',
      place: 1,
      division: 'MPO',
      pointsTable,
      tournament: { id: 't-1', multiplierId: 'multiplier-major' },
      multipliers: [{ id: 'multiplier-major', multiplier: 2 }],
      existingResults: [],
    });

    assert.equal(result.multiplierSnapshot, 2);
    assert.equal(result.calculatedPoints, 40);
  });

  assert.equal(created.basePointsSnapshot, 20);
  assert.equal(created.multiplierSnapshot, 3);
  assert.equal(created.calculatedPoints, 60);

  const updated = updateTournamentResult({
    results: [created],
    resultId: created.id,
    tournamentId: 't-1',
    playerId: 'p-1',
    place: 2,
    division: 'MPO',
    pointsTable,
    multiplier: 4,
  });

  assert.equal(updated.basePointsSnapshot, 10);
  assert.equal(updated.multiplierSnapshot, 4);
  assert.equal(updated.calculatedPoints, 40);
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
    multiplier: 1,
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '3T4', calculatedPoints: null },
      { playerId: 'player-2', division: 'MPO', placement: '4', calculatedPoints: null },
    ],
  };

  assert.throws(() => recalculateResultCard({
    card,
    players: [],
    pointsTable,
    multipliers: [],
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
    multiplier: 2,
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '1', calculatedPoints: null },
      { playerId: 'player-2', division: 'MPO', placement: '3T2', calculatedPoints: null },
      { playerId: 'player-3', division: 'MPO', placement: '3T2', calculatedPoints: null },
    ],
  };

  const recalculated = recalculateResultCard({
    card,
    players: [],
    pointsTable,
    multipliers: [],
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
    multiplier: 1,
    results: [
      { playerId: 'player-1', division: 'MPO', placement: '3T2', calculatedPoints: null },
      { playerId: 'player-2', division: 'MPO', placement: '3T2', calculatedPoints: null },
      { playerId: 'player-3', division: 'MPO', placement: '3T2', calculatedPoints: null },
    ],
  };

  assert.throws(() => recalculateResultCard({
    card,
    players: [],
    pointsTable,
    multipliers: [],
  }), /liikaa rivejä/);
});

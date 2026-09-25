import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyPointsTable,
  upsertPointsTableEntry,
  calculatePoints,
  createTournamentResult,
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
  assert.throws(() => calculatePoints({ basePoints: 10, multiplier: 0 }), /Multiplierin pitää olla nollaa suurempi/);

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

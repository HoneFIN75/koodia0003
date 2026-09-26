import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTournament,
  DEFAULT_TOURNAMENT_DISPLAY_ORDER,
  filterAndSortTournaments,
  sortTournaments,
  TournamentValidationError,
} from '../js/tournaments.js';

test('creates a tournament without unknown legacy fields', () => {
  const tournament = createTournament({
    name: 'SFL Open',
    multiplierKey: 'fpt',
    startDate: '2026-07-03',
    displayOrder: '7',
    pdgaEventId: '123456',
    legacyField: 'poistuva arvo',
  });

  assert.equal(tournament.name, 'SFL Open');
  assert.equal(tournament.multiplierKey, 'fpt');
  assert.equal(tournament.multiplier, 1);
  assert.equal(tournament.displayOrder, 7);
  assert.equal(tournament.pdgaEventId, 123456);
  assert.ok(!Object.hasOwn(tournament, 'legacyField'));
});

test('rejects empty or invalid display order with field error', () => {
  assert.throws(
    () =>
      createTournament({
        name: 'SFL Open',
        multiplierKey: 'fpt',
        startDate: '2026-07-03',
        displayOrder: '0',
      }),
    (error) => {
      assert.ok(error instanceof TournamentValidationError);
      assert.equal(error.fieldErrors.displayOrder, 'Järjestysnumeron pitää olla positiivinen kokonaisluku.');
      return true;
    },
  );
});

test('rejects invalid PDGA event id', () => {
  assert.throws(
    () =>
      createTournament({
        name: 'SFL Open',
        multiplierKey: 'fpt',
        startDate: '2026-07-03',
        displayOrder: '7',
        pdgaEventId: 'abc',
      }),
    (error) => {
      assert.ok(error instanceof TournamentValidationError);
      assert.equal(error.fieldErrors.pdgaEventId, 'PDGA-kilpailutunnus pitää olla positiivinen kokonaisluku.');
      return true;
    },
  );
});

test('sorts tournaments deterministically by display order, date, createdAt and id', () => {
  const tournaments = [
    {
      id: 'tournament-b',
      name: 'B',
      displayOrder: 2,
      startDate: '2026-07-02',
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'tournament-d',
      name: 'D',
      displayOrder: 1,
      startDate: '2026-07-01',
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'tournament-a',
      name: 'A',
      displayOrder: 1,
      startDate: '2026-07-01',
      createdAt: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'tournament-c',
      name: 'C',
      displayOrder: 1,
      startDate: '2026-07-03',
      createdAt: '2026-01-01T08:00:00.000Z',
    },
  ];

  const sortedIds = sortTournaments(tournaments).map((tournament) => tournament.id);

  assert.deepEqual(sortedIds, ['tournament-a', 'tournament-d', 'tournament-c', 'tournament-b']);
});

test('filters tournaments by search and sorts by configured field', () => {
  const tournaments = [
    {
      id: 'tournament-1',
      name: 'Lahti Open',
      status: 'Vahvistettu',
      location: 'Lahti',
      venue: 'Mukkula',
      startDate: '2026-07-05',
      endDate: '2026-07-06',
      displayOrder: 3,
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'tournament-2',
      name: 'Turku Masters',
      status: 'Luonnos',
      location: 'Turku',
      venue: 'Aninkainen',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      displayOrder: 1,
      createdAt: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'tournament-3',
      name: 'Lahti Challenge',
      status: 'Vahvistettu',
      location: 'Lahti',
      venue: 'Tali',
      startDate: '2026-07-03',
      endDate: '2026-07-04',
      displayOrder: 2,
      createdAt: '2026-01-01T08:00:00.000Z',
    },
  ];

  const filteredIds = filterAndSortTournaments(tournaments, {
    search: 'lahti',
    status: 'Vahvistettu',
    sortField: 'name',
    sortDirection: 'asc',
  }).map((tournament) => tournament.id);

  assert.deepEqual(filteredIds, ['tournament-3', 'tournament-1']);
});

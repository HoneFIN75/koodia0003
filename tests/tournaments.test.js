import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournament } from '../js/tournaments.js';

test('creates a tournament without unknown legacy fields', () => {
  const tournament = createTournament({
    name: 'SFL Open',
    multiplierKey: 'fpt',
    startDate: '2026-07-03',
    legacyField: 'poistuva arvo',
  });

  assert.equal(tournament.name, 'SFL Open');
  assert.equal(tournament.multiplierKey, 'fpt');
  assert.equal(tournament.multiplier, 1);
  assert.ok(!Object.hasOwn(tournament, 'legacyField'));
});

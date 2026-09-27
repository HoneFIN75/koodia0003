import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMultiplier,
  updateMultiplier,
  removeMultiplier,
  sortMultipliers,
  validateMultiplierInput,
  MultiplierValidationError,
  sanitizeMultipliers,
} from '../js/multipliers.js';

test('validateMultiplierInput hyväksyy suomalaisen desimaalierottimen ja normalisoi arvon', () => {
  const validated = validateMultiplierInput([], {
    orderNumber: '1',
    name: 'Major',
    abbreviation: 'maj',
    multiplier: '1,25',
  });

  assert.equal(validated.orderNumber, 1);
  assert.equal(validated.name, 'Major');
  assert.equal(validated.abbreviation, 'MAJ');
  assert.equal(validated.multiplier, 1.25);
});

test('validateMultiplierInput hylkää piste-erottimen kertoimessa', () => {
  assert.throws(
    () =>
      validateMultiplierInput([], {
        orderNumber: '1',
        name: 'Major',
        abbreviation: 'MAJ',
        multiplier: '1.5',
      }),
    (error) => {
      assert.ok(error instanceof MultiplierValidationError);
      assert.equal(
        error.fieldErrors.multiplier,
        'Kerroin pitää syöttää suomalaisella desimaalierottimella (esim. 1,25).',
      );
      return true;
    },
  );
});

test('createMultiplier ja updateMultiplier varmistavat uniikit järjestysnumerot ja lyhenteet', () => {
  const created = createMultiplier([], {
    orderNumber: '1',
    name: 'Major',
    abbreviation: 'MAJ',
    multiplier: '2,00',
  });

  assert.equal(created.orderNumber, 1);

  assert.throws(
    () =>
      createMultiplier([created], {
        orderNumber: '1',
        name: 'National Tour',
        abbreviation: 'NT',
        multiplier: '1,50',
      }),
    /Järjestysnumero 1 on jo käytössä\./,
  );

  assert.throws(
    () =>
      createMultiplier([created], {
        orderNumber: '2',
        name: 'Major',
        abbreviation: 'M2',
        multiplier: '1,50',
      }),
    /Nimi Major on jo käytössä\./,
  );

  const updated = updateMultiplier([created], created.id, {
    orderNumber: '2',
    name: 'Major Plus',
    abbreviation: 'MP',
    multiplier: '2,50',
  });

  assert.equal(updated.orderNumber, 2);
  assert.equal(updated.abbreviation, 'MP');
  assert.equal(updated.multiplier, 2.5);
});

test('sortMultipliers järjestää oletuksena järjestysnumeron mukaan nousevasti', () => {
  const sorted = sortMultipliers([
    { id: 'b', orderNumber: 3, abbreviation: 'B', multiplier: 1, name: 'B' },
    { id: 'a', orderNumber: 1, abbreviation: 'A', multiplier: 1, name: 'A' },
    { id: 'c', orderNumber: 2, abbreviation: 'C', multiplier: 1, name: 'C' },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['a', 'c', 'b'],
  );
});

test('sanitizeMultipliers poistaa duplikaatit ja palauttaa oletukset tarvittaessa', () => {
  const sanitized = sanitizeMultipliers([
    { id: 'x', orderNumber: 1, name: 'Major', abbreviation: 'MAJ', multiplier: 2 },
    { id: 'y', orderNumber: 1, name: 'Duplicate order', abbreviation: 'DUP', multiplier: 3 },
  ]);

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].id, 'x');
  assert.ok(sanitizeMultipliers([]).length > 0);
});

test('removeMultiplier poistaa rivin ja hylkää puuttuvan id:n', () => {
  const items = [
    { id: 'a', orderNumber: 1, name: 'Major', abbreviation: 'MAJ', multiplier: 2 },
    { id: 'b', orderNumber: 2, name: 'NT', abbreviation: 'NT', multiplier: 1.5 },
  ];

  const updated = removeMultiplier(items, 'a');
  assert.deepEqual(updated.map((entry) => entry.id), ['b']);

  assert.throws(() => removeMultiplier(items, 'unknown'), /Poistettavaa kerrointa ei löytynyt\./);
});

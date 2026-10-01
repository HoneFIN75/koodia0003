import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPdgaEventUrl,
  buildPdgaPlayerUrl,
  DEFAULT_PDGA_SETTINGS,
  DEFAULT_POINT_DECIMALS,
  extractPdgaEventId,
  extractPdgaPlayerId,
  isUnassignedPdgaEventId,
  sanitizePointDecimals,
  SettingsValidationError,
  validateSettingsInput,
} from '../js/pdga.js';

test('extracts player and event ids from full PDGA urls', () => {
  assert.equal(extractPdgaPlayerId('https://www.pdga.com/player/12345'), 12345);
  assert.equal(extractPdgaEventId('https://www.pdga.com/tour/event/98765'), 98765);
  assert.equal(extractPdgaEventId('https://www.pdga.com/tour/event/000000'), '');
});

test('identifies unassigned PDGA event id 000000', () => {
  assert.equal(isUnassignedPdgaEventId('000000'), true);
  assert.equal(isUnassignedPdgaEventId('  000000  '), true);
  assert.equal(isUnassignedPdgaEventId(0), true);
  assert.equal(isUnassignedPdgaEventId('97339'), false);
  assert.equal(isUnassignedPdgaEventId(97339), false);
  assert.equal(isUnassignedPdgaEventId(''), false);
  assert.equal(isUnassignedPdgaEventId(null), false);
});

test('builds PDGA links from centralized settings and ids', () => {
  assert.equal(
    buildPdgaPlayerUrl(DEFAULT_PDGA_SETTINGS, { pdgaNumber: 12345 }),
    'https://www.pdga.com/player/12345',
  );
  assert.equal(
    buildPdgaEventUrl(DEFAULT_PDGA_SETTINGS, { pdgaEventId: 98765 }),
    'https://www.pdga.com/tour/event/98765',
  );
  assert.equal(
    buildPdgaEventUrl(DEFAULT_PDGA_SETTINGS, { pdgaEventId: '000000' }),
    '',
  );
  assert.equal(
    buildPdgaEventUrl(DEFAULT_PDGA_SETTINGS, { pdgaEventId: 0 }),
    '',
  );
});

test('does not build player link without a PDGA id', () => {
  assert.equal(buildPdgaPlayerUrl(DEFAULT_PDGA_SETTINGS, { pdgaNumber: '' }), '');
  assert.equal(buildPdgaPlayerUrl(DEFAULT_PDGA_SETTINGS, {}), '');
});

test('normalizes PDGA settings with trailing slashes', () => {
  const settings = validateSettingsInput({
    playerBaseUrl: 'https://example.com/player',
    eventBaseUrl: 'https://example.com/event',
  });

  assert.deepEqual(settings, {
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://example.com/event/',
    pointDecimals: 2,
  });
});

test('rejects invalid PDGA settings urls', () => {
  assert.throws(
    () =>
      validateSettingsInput({
        playerBaseUrl: 'ftp://example.com/player',
        eventBaseUrl: '',
      }),
    (error) => {
      assert.ok(error instanceof SettingsValidationError);
      assert.equal(error.fieldErrors.playerBaseUrl, 'PDGA-pelaajaosoitteen perus-URL ei ole kelvollinen verkko-osoite.');
      assert.equal(error.fieldErrors.eventBaseUrl, 'PDGA-kilpailuosoitteen perus-URL on pakollinen.');
      return true;
    },
  );
});

test('validates and sanitizes the point rounding setting', () => {
  const settings = validateSettingsInput({
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://example.com/event/',
    pointDecimals: '4',
  });

  assert.equal(settings.pointDecimals, 4);
  assert.equal(sanitizePointDecimals('0'), 0);
  assert.equal(sanitizePointDecimals('5'), DEFAULT_POINT_DECIMALS);
  assert.equal(sanitizePointDecimals(''), DEFAULT_POINT_DECIMALS);
  assert.throws(
    () =>
      validateSettingsInput({
        playerBaseUrl: 'https://example.com/player/',
        eventBaseUrl: 'https://example.com/event/',
        pointDecimals: '7',
      }),
    (error) => {
      assert.ok(error instanceof SettingsValidationError);
      assert.equal(error.fieldErrors.pointDecimals, 'Pyöristys pitää olla arvo väliltä 0–4.');
      return true;
    },
  );
});

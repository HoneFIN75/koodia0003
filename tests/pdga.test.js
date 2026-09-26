import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPdgaEventUrl,
  buildPdgaPlayerUrl,
  DEFAULT_PDGA_SETTINGS,
  extractPdgaEventId,
  extractPdgaPlayerId,
  SettingsValidationError,
  validateSettingsInput,
} from '../js/pdga.js';

test('extracts player and event ids from full PDGA urls', () => {
  assert.equal(extractPdgaPlayerId('https://www.pdga.com/player/12345'), 12345);
  assert.equal(extractPdgaEventId('https://www.pdga.com/tour/event/98765'), 98765);
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
});

test('normalizes PDGA settings with trailing slashes', () => {
  const settings = validateSettingsInput({
    playerBaseUrl: 'https://example.com/player',
    eventBaseUrl: 'https://example.com/event',
  });

  assert.deepEqual(settings, {
    playerBaseUrl: 'https://example.com/player/',
    eventBaseUrl: 'https://example.com/event/',
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

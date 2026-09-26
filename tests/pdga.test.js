import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPdgaReferenceUrl,
  extractPdgaIdFromValue,
  sanitizePdgaSettings,
} from '../js/pdga.js';

test('buildPdgaReferenceUrl combines base URL and ID', () => {
  const url = buildPdgaReferenceUrl('https://www.pdga.com/player', '12345');
  assert.equal(url, 'https://www.pdga.com/player/12345');
});

test('extractPdgaIdFromValue extracts ID from legacy full URL', () => {
  assert.equal(extractPdgaIdFromValue('https://www.pdga.com/player/67890'), '67890');
  assert.equal(extractPdgaIdFromValue('https://www.pdga.com/tour/event/98765?foo=bar'), '98765');
});

test('sanitizePdgaSettings falls back to defaults for invalid URLs', () => {
  const settings = sanitizePdgaSettings({
    pdgaPlayerBaseUrl: 'not-a-url',
    pdgaEventBaseUrl: 'https://events.example/pdga',
  });

  assert.equal(settings.pdgaPlayerBaseUrl, 'https://www.pdga.com/player/');
  assert.equal(settings.pdgaEventBaseUrl, 'https://events.example/pdga/');
});

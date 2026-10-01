import test from 'node:test';
import assert from 'node:assert/strict';
import { logErrors } from '../js/errorLog.js';

test('logErrors lähettää virheet keskitettyyn virhelokiin /api/errors', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true };
  };

  const logged = await logErrors(
    'resultCardImport',
    [
      { message: 'Virheellinen sijoitus "ABC".', rowNumber: 3, pdgaId: '12345', column: 'T2', extra: 'x' },
      { message: '   ' },
    ],
    { fetchImpl, moduleUrl: 'http://localhost/js/errorLog.js' },
  );

  assert.equal(logged, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost/api/errors');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    source: 'resultCardImport',
    errors: [{ message: 'Virheellinen sijoitus "ABC".', rowNumber: 3, pdgaId: '12345', column: 'T2' }],
  });
});

test('logErrors ei koskaan heitä virhettä eikä lähetä tyhjää lokia', async () => {
  let called = false;
  assert.equal(await logErrors('x', [], { fetchImpl: async () => { called = true; return { ok: true }; } }), false);
  assert.equal(called, false);
  assert.equal(await logErrors('x', [{ message: 'virhe' }], {
    fetchImpl: async () => { throw new Error('verkko'); },
    moduleUrl: 'http://localhost/js/errorLog.js',
  }), false);
});

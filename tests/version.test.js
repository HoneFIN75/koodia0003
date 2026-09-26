import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDeploymentMetadata } from '../js/version.js';

test('loadDeploymentMetadata loads version.json from the current hosting base path', async () => {
  let requestedUrl = '';
  const fetchImpl = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      async json() {
        return {
          version: '1.0.15',
          deployedAt: '2026-09-26T20:14:00Z',
          commit: '84f2c71',
        };
      },
    };
  };

  const metadata = await loadDeploymentMetadata({
    fetchImpl,
    locationObject: { href: 'https://example.com/koodia0003/index.html' },
  });

  assert.equal(metadata?.version, '1.0.15');
  assert.equal(metadata?.deployedAt, '2026-09-26T20:14:00Z');
  assert.equal(metadata?.commit, '84f2c71');
  assert.match(requestedUrl, /^https:\/\/example\.com\/koodia0003\/version\.json\?v=\d+$/);
});

test('loadDeploymentMetadata returns null when metadata is missing', async () => {
  const metadata = await loadDeploymentMetadata({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { deployedAt: '2026-09-26T20:14:00Z' };
      },
    }),
    locationObject: { href: 'https://example.com/' },
  });

  assert.equal(metadata, null);
});

test('loadDeploymentMetadata returns null when request fails', async () => {
  const metadata = await loadDeploymentMetadata({
    fetchImpl: async () => ({ ok: false }),
    locationObject: { href: 'https://example.com/' },
  });

  assert.equal(metadata, null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDeploymentMetadata } from '../js/version.js';

test('loadDeploymentMetadata loads version.json from module base path', async () => {
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
    moduleUrl: 'https://example.com/koodia0003/js/version.js',
  });

  assert.equal(metadata?.version, '1.0.15');
  assert.equal(metadata?.deployedAt, '2026-09-26T20:14:00Z');
  assert.equal(metadata?.commit, '84f2c71');
  assert.match(requestedUrl, /^https:\/\/example\.com\/koodia0003\/version\.json\?v=\d+$/);
});

test('loadDeploymentMetadata resolves metadata correctly for non-index document entry points', async () => {
  let requestedUrl = '';
  await loadDeploymentMetadata({
    fetchImpl: async (url) => {
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
    },
    moduleUrl: 'https://example.com/koodia0003/js/version.js?entry=app.html',
  });

  assert.match(requestedUrl, /^https:\/\/example\.com\/koodia0003\/version\.json\?v=\d+$/);
});

test('loadDeploymentMetadata keeps dotted directory names as directories', async () => {
  let requestedUrl = '';
  await loadDeploymentMetadata({
    fetchImpl: async (url) => {
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
    },
    moduleUrl: 'https://example.com/sfl.v2/js/version.js',
  });

  assert.match(requestedUrl, /^https:\/\/example\.com\/sfl\.v2\/version\.json\?v=\d+$/);
});

test('loadDeploymentMetadata returns null when metadata is missing', async () => {
  const metadata = await loadDeploymentMetadata({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { deployedAt: '2026-09-26T20:14:00Z' };
      },
    }),
    moduleUrl: 'https://example.com/js/version.js',
  });

  assert.equal(metadata, null);
});

test('loadDeploymentMetadata returns null when request fails', async () => {
  const metadata = await loadDeploymentMetadata({
    fetchImpl: async () => ({ ok: false }),
    moduleUrl: 'https://example.com/js/version.js',
  });

  assert.equal(metadata, null);
});

test('loadDeploymentMetadata memoizes by module url', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
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

  await loadDeploymentMetadata({ fetchImpl, moduleUrl: 'https://example.com/cache/js/version.js' });
  await loadDeploymentMetadata({ fetchImpl, moduleUrl: 'https://example.com/cache/js/version.js' });

  assert.equal(calls, 1);
});

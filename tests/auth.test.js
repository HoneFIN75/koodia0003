import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_STORAGE_KEY,
  AuthRequiredError,
  changeSitePassword,
  getAuthHeaders,
  isAuthenticated,
  login,
  logout,
  validateSitePasswordInput,
} from '../js/auth.js';
import { loadState } from '../js/storage.js';
import { renderLoginView } from '../js/login.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

test('login stores token from API and logout clears it', async () => {
  const storage = createMemoryStorage();
  const token = await login('salasana-123', {
    storage,
    moduleUrl: 'https://example.com/js/auth.js',
    fetchImpl: async (url, options) => {
      assert.equal(url.href, 'https://example.com/api/login');
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { password: 'salasana-123' });
      return createJsonResponse({ token: 'abc.def' });
    },
  });

  assert.equal(token, 'abc.def');
  assert.equal(storage.getItem(AUTH_STORAGE_KEY), 'abc.def');
  assert.equal(isAuthenticated({ storage }), true);
  assert.deepEqual(getAuthHeaders({ storage }), { 'X-SFL-Auth-Token': 'abc.def' });

  logout({ storage });
  assert.equal(isAuthenticated({ storage }), false);
  assert.deepEqual(getAuthHeaders({ storage }), {});
});

test('login rejects wrong password with Finnish message and stores nothing', async () => {
  const storage = createMemoryStorage();
  await assert.rejects(
    login('väärä', {
      storage,
      fetchImpl: async () => createJsonResponse({ message: 'Väärä salasana. Yritä uudelleen.' }, 401),
    }),
    /Väärä salasana\. Yritä uudelleen\./,
  );
  assert.equal(isAuthenticated({ storage }), false);
});

test('validateSitePasswordInput enforces length', () => {
  assert.match(validateSitePasswordInput(''), /Syötä uusi salasana/);
  assert.match(validateSitePasswordInput('lyhyt'), /8–200 merkkiä/);
  assert.equal(validateSitePasswordInput('riittävän-pitkä'), '');
});

test('changeSitePassword sends auth token and maps 401 to AuthRequiredError', async () => {
  const storage = createMemoryStorage();
  storage.setItem(AUTH_STORAGE_KEY, 'tunniste');

  await changeSitePassword('uusi-salasana', {
    storage,
    moduleUrl: 'https://example.com/js/auth.js',
    fetchImpl: async (url, options) => {
      assert.equal(url.href, 'https://example.com/api/site-password');
      assert.equal(options.method, 'PUT');
      assert.equal(options.headers['X-SFL-Auth-Token'], 'tunniste');
      return createJsonResponse({ message: 'ok' });
    },
  });

  await assert.rejects(
    changeSitePassword('uusi-salasana', { storage, fetchImpl: async () => createJsonResponse({}, 401) }),
    AuthRequiredError,
  );
});

test('loadState maps 401 responses to AuthRequiredError', async () => {
  await assert.rejects(
    loadState({
      moduleUrl: 'https://example.com/js/storage.js',
      fetchImpl: async () => createJsonResponse({ message: 'Kirjautuminen vaaditaan.' }, 401),
    }),
    AuthRequiredError,
  );
});

test('renderLoginView shows only the login form with accessible error message', () => {
  const root = { innerHTML: '' };
  renderLoginView(root, { errorMessage: 'Väärä salasana. Yritä uudelleen.' });

  assert.match(root.innerHTML, /<h1 id="login-title">SFL Porkkana<\/h1>/);
  assert.doesNotMatch(root.innerHTML, /Tervetuloa! Syötä salasana jatkaaksesi\./);
  assert.match(root.innerHTML, /<label for="login-password">Salainen runno<\/label>/);
  assert.match(root.innerHTML, /type="password"/);
  assert.match(root.innerHTML, />\s*Kirjaudu\s*</);
  assert.match(root.innerHTML, /role="alert"[^>]*>.*Väärä salasana\. Yritä uudelleen\./s);
  assert.match(root.innerHTML, /aria-invalid="true" aria-describedby="login-error"/);
  assert.doesNotMatch(root.innerHTML, /main-nav|Pelaajat|Ranking/);
});

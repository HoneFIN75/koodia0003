import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createJsonFileStorage } from '../server/json-file-storage.mjs';
import { createServer } from '../server/app.mjs';
import { createSiteAuth, DEFAULT_SITE_PASSWORD } from '../server/site-auth.mjs';

async function createTempDir() {
  return mkdtemp(path.join(os.tmpdir(), 'sfl-jsondb-'));
}

test('json storage creates expected files automatically', async () => {
  const directoryPath = await createTempDir();
  const storage = createJsonFileStorage({ directoryPath });

  try {
    const state = await storage.loadState();

    assert.deepEqual(state.players, []);
    assert.deepEqual(state.tournaments, []);
    assert.deepEqual(state.resultCards, []);

    const fileNames = [
      'state.json',
      'players.json',
      'tournaments.json',
      'resultCards.json',
      'scoreTables.json',
      'multipliers.json',
      'settings.json',
    ];

    for (const fileName of fileNames) {
      const filePath = path.join(directoryPath, fileName);
      const contents = JSON.parse(await readFile(filePath, 'utf8'));
      assert.ok(contents !== undefined, `${fileName} should exist`);
    }
  } finally {
    await rm(directoryPath, { recursive: true, force: true });
  }
});

test('API loads and saves shared state through JSON storage', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const initialResponse = await fetch(`${baseUrl}/api/state`);
    assert.equal(initialResponse.status, 200);
    const initialState = await initialResponse.json();
    assert.deepEqual(initialState.players, []);

    const saveResponse = await fetch(`${baseUrl}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...initialState,
        players: [
          {
            id: 'player-1',
            name: 'Testi Pelaaja',
            firstName: 'Testi',
            lastName: 'Pelaaja',
            division: 'MPO',
            pdgaProfileUrl: 'https://www.pdga.com/player/12345',
          },
        ],
      }),
    });
    assert.equal(saveResponse.status, 200);
    const savedState = await saveResponse.json();
    assert.equal(savedState.players[0].pdgaNumber, 12345);

    const reloadedResponse = await fetch(`${baseUrl}/api/state`);
    const reloadedState = await reloadedResponse.json();
    assert.equal(reloadedState.players[0].pdgaNumber, 12345);
    assert.deepEqual(reloadedState.pointsTable, { MPO: {}, FPO: {} });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('API rejects malformed JSON bodies with Finnish error message', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"players":',
    });

    assert.equal(response.status, 400);
    assert.match(await response.text(), /Pyynnön JSON-data on virheellinen\./);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('API rejects partial state payloads to avoid clearing unrelated data', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ players: [] }),
    });

    assert.equal(response.status, 400);
    assert.match(await response.text(), /Tallennettava tila on puutteellinen\./);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('API rejects unsupported methods for /api/state', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/state`, {
      method: 'POST',
    });

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, PUT');
    assert.match(await response.text(), /Metodia ei tueta\./);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('API rejects unauthorized writes and accepts authorized proxy writes', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const authorizeWriteRequest = (request) =>
    request.headers['x-sfl-proxy-authenticated'] === 'true'
    && request.headers['x-sfl-write-token'] === 'proxy-token';
  const server = createServer({ publicDir, storage, authorizeWriteRequest });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}/api/state`;
    const initialState = await (await fetch(baseUrl)).json();

    const forbiddenResponse = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initialState),
    });
    assert.equal(forbiddenResponse.status, 403);
    assert.match(await forbiddenResponse.text(), /Tallennus on sallittu vain paikallisen palvelimen kautta tai suojatulla välityspalvelimella\./);

    const authorizedResponse = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SFL-Proxy-Authenticated': 'true',
        'X-SFL-Write-Token': 'proxy-token',
      },
      body: JSON.stringify(initialState),
    });
    assert.equal(authorizedResponse.status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('static HEAD request returns headers without body', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  await writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>SFL</title>', 'utf8');
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/index.html`, {
      method: 'HEAD',
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-length'), String('<!doctype html><title>SFL</title>'.length));
    assert.equal(await response.text(), '');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('static image assets are served with image content types', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  await mkdir(path.join(publicDir, 'assets'), { recursive: true });
  const imageTypes = {
    'login-background.png': 'image/png',
    'login-background.jpg': 'image/jpeg',
    'login-background.jpeg': 'image/jpeg',
    'login-background.webp': 'image/webp',
  };
  for (const fileName of Object.keys(imageTypes)) {
    await writeFile(path.join(publicDir, 'assets', fileName), 'image', 'utf8');
  }
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    for (const [fileName, contentType] of Object.entries(imageTypes)) {
      const response = await fetch(`http://127.0.0.1:${address.port}/assets/${fileName}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), contentType);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('server exposes only published frontend assets and rejects invalid URL encoding', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  await writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>SFL</title>', 'utf8');
  await writeFile(path.join(publicDir, 'package.json'), '{"private":true}', 'utf8');
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const hiddenResponse = await fetch(`http://127.0.0.1:${address.port}/package.json`);
    assert.equal(hiddenResponse.status, 404);

    const invalidUrlResponse = await fetch(`http://127.0.0.1:${address.port}/%E0%A4%A`);
    assert.equal(invalidUrlResponse.status, 400);
    assert.match(await invalidUrlResponse.text(), /Pyynnön osoite ei ole kelvollinen\./);

    const methodResponse = await fetch(`http://127.0.0.1:${address.port}/index.html`, {
      method: 'POST',
    });
    assert.equal(methodResponse.status, 405);
    assert.equal(methodResponse.headers.get('allow'), 'GET, HEAD');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('API protects state with the shared site password when site auth is enabled', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const siteAuth = createSiteAuth({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage, siteAuth });

  async function login(baseUrl, password) {
    return fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  }

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    assert.equal((await fetch(`${baseUrl}/api/state`)).status, 401);

    const wrongResponse = await login(baseUrl, 'väärä-salasana');
    assert.equal(wrongResponse.status, 401);
    assert.match(await wrongResponse.text(), /Väärä salasana\. Yritä uudelleen\./);

    const loginResponse = await login(baseUrl, DEFAULT_SITE_PASSWORD);
    assert.equal(loginResponse.status, 200);
    const { token } = await loginResponse.json();

    const stateResponse = await fetch(`${baseUrl}/api/state`, { headers: { 'X-SFL-Auth-Token': token } });
    assert.equal(stateResponse.status, 200);
    const state = await stateResponse.json();
    assert.equal(Object.hasOwn(state.settings, 'sitePasswordHash'), false);

    const saveResponse = await fetch(`${baseUrl}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-SFL-Auth-Token': token },
      body: JSON.stringify(state),
    });
    assert.equal(saveResponse.status, 200);

    const settingsFile = JSON.parse(await readFile(path.join(jsondbDir, 'settings.json'), 'utf8'));
    assert.match(settingsFile.sitePasswordHash, /^scrypt\$/);
    assert.ok(settingsFile.authSecret);
    assert.equal(settingsFile.pointDecimals, 2);

    const shortResponse = await fetch(`${baseUrl}/api/site-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-SFL-Auth-Token': token },
      body: JSON.stringify({ password: 'lyhyt' }),
    });
    assert.equal(shortResponse.status, 400);

    const changeResponse = await fetch(`${baseUrl}/api/site-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-SFL-Auth-Token': token },
      body: JSON.stringify({ password: 'uusi-salasana-123' }),
    });
    assert.equal(changeResponse.status, 200);

    assert.equal((await login(baseUrl, DEFAULT_SITE_PASSWORD)).status, 401);
    assert.equal((await login(baseUrl, 'uusi-salasana-123')).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/state`, { headers: { 'X-SFL-Auth-Token': token } })).status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

test('API appends errors to jsondb/errors.json through the centralized error log', async () => {
  const publicDir = await createTempDir();
  const jsondbDir = await createTempDir();
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  const server = createServer({ publicDir, storage });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const post = (body) => fetch(`${baseUrl}/api/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const response = await post({
      source: 'resultCardImport',
      errors: [
        { message: 'PDGA ID:llä ei löydy pelaajaa.', rowNumber: 2, pdgaId: '99999' },
        { message: 'Virheellinen sijoitus "1TT2".', rowNumber: 3, pdgaId: '12345', column: 'T1', extra: 'ignored' },
      ],
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { logged: 2 });
    assert.equal((await post({ source: 'resultCardImport', errors: [{ message: 'Import epäonnistui.' }] })).status, 200);

    const errors = JSON.parse(await readFile(path.join(jsondbDir, 'errors.json'), 'utf8'));
    assert.equal(errors.length, 3);
    assert.deepEqual(
      errors.map(({ timestamp, ...entry }) => entry),
      [
        { source: 'resultCardImport', message: 'PDGA ID:llä ei löydy pelaajaa.', rowNumber: 2, pdgaId: '99999' },
        { source: 'resultCardImport', message: 'Virheellinen sijoitus "1TT2".', rowNumber: 3, pdgaId: '12345', column: 'T1' },
        { source: 'resultCardImport', message: 'Import epäonnistui.' },
      ],
    );
    errors.forEach((entry) => assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/));

    assert.equal((await post({ source: 'resultCardImport', errors: [] })).status, 400);
    assert.equal((await post({ errors: [{ message: 'x' }] })).status, 400);
    assert.equal((await post({ source: 'x', errors: [{ message: '   ' }] })).status, 400);
    const getResponse = await fetch(`${baseUrl}/api/errors`);
    assert.equal(getResponse.status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(publicDir, { recursive: true, force: true });
    await rm(jsondbDir, { recursive: true, force: true });
  }
});

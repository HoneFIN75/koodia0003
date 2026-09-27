import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createJsonFileStorage } from '../server/json-file-storage.mjs';
import { createServer } from '../server/app.mjs';

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
    assert.deepEqual(state.tournamentResults, []);

    const fileNames = [
      'state.json',
      'players.json',
      'tournaments.json',
      'tournamentResults.json',
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

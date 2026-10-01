import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hasPhp = spawnSync('php', ['-v'], { stdio: 'ignore' }).status === 0;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError || new Error('PHP server did not become ready in time');
}

async function startPhpServer() {
  const jsondbDir = await mkdtemp(path.join(os.tmpdir(), 'sfl-php-jsondb-'));
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sfl-php-router-'));
  const routerPath = path.join(tempDir, 'router.php');
  const apiIndexPath = path.join(rootDir, 'api', 'index.php').replaceAll('\\', '\\\\');
  await writeFile(routerPath, `<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api/(state|health|login|site-password|errors)$#', $path, $matches)) {
    $_GET['endpoint'] = $matches[1];
    require '${apiIndexPath}';
    return true;
}
return false;
`, 'utf8');

  const port = await getFreePort();
  const serverProcess = spawn('php', ['-S', `127.0.0.1:${port}`, routerPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      SFL_JSONDB_PATH: jsondbDir,
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${baseUrl}/api/health`);

  return {
    baseUrl,
    jsondbDir,
    async stop() {
      serverProcess.kill('SIGTERM');
      await rm(jsondbDir, { recursive: true, force: true });
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function loginToPhp(baseUrl, password = 'sfl-pisteet-2026') {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.equal(response.status, 200);
  const { token } = await response.json();
  assert.match(token, /^[a-f0-9]{32}\.[a-f0-9]{64}$/);
  return token;
}

test('PHP API supports state save/load and compatibility payloads', { skip: !hasPhp }, async () => {
  const server = await startPhpServer();
  const port = new URL(server.baseUrl).port;
  const { jsondbDir } = server;

  try {
    const token = await loginToPhp(server.baseUrl);

    const fullStatePayload = {
      players: [],
      tournaments: [],
      resultCards: [],
      settings: {},
      pointsTable: { MPO: {}, FPO: {} },
      multipliers: [],
    };

    const saveResponse = await fetch(`http://127.0.0.1:${port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SFL-Auth-Token': token,
      },
      body: JSON.stringify(fullStatePayload),
    });
    assert.equal(saveResponse.status, 200);

    const invalidJsonResponse = await fetch(`http://127.0.0.1:${port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SFL-Auth-Token': token,
      },
      body: '{"players":',
    });
    assert.equal(invalidJsonResponse.status, 400);
    assert.match(await invalidJsonResponse.text(), /Pyynnön JSON-data on virheellinen\./);

    const incompleteResponse = await fetch(`http://127.0.0.1:${port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SFL-Auth-Token': token,
      },
      body: JSON.stringify({ players: [] }),
    });
    assert.equal(incompleteResponse.status, 400);
    assert.match(await incompleteResponse.text(), /Tallennettava tila on puutteellinen\./);

    const compatibilityResponse = await fetch(`http://127.0.0.1:${port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-SFL-Auth-Token': token,
      },
      body: JSON.stringify({
        players: [],
        tournaments: [],
        tournamentResults: [{ playerId: 'player-1', placement: '1' }],
        settings: {},
        scoreTables: { MPO: { 1: 100 }, FPO: {} },
        multipliers: [],
      }),
    });

    assert.equal(compatibilityResponse.status, 200);
    const compatibilityState = await compatibilityResponse.json();
    assert.equal(Array.isArray(compatibilityState.resultCards), true);
    assert.equal(compatibilityState.resultCards.length, 1);
    assert.deepEqual(compatibilityState.pointsTable.MPO, { 1: 100 });

    const tournamentResultsSlice = JSON.parse(await readFile(path.join(jsondbDir, 'tournamentResults.json'), 'utf8'));
    assert.equal(Array.isArray(tournamentResultsSlice), true);
    assert.equal(tournamentResultsSlice.length, 1);
  } finally {
    await server.stop();
  }
});

test('PHP API protects state with the shared site password', { skip: !hasPhp }, async () => {
  const server = await startPhpServer();
  const { baseUrl, jsondbDir } = server;

  try {
    const anonymousResponse = await fetch(`${baseUrl}/api/state`);
    assert.equal(anonymousResponse.status, 401);
    assert.match(await anonymousResponse.text(), /Kirjautuminen vaaditaan/);

    const forgedResponse = await fetch(`${baseUrl}/api/state`, {
      headers: { 'X-SFL-Auth-Token': `${'a'.repeat(32)}.${'b'.repeat(64)}` },
    });
    assert.equal(forgedResponse.status, 401);

    const wrongPasswordResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'väärä-salasana' }),
    });
    assert.equal(wrongPasswordResponse.status, 401);
    const wrongPasswordPayload = await wrongPasswordResponse.json();
    assert.equal(wrongPasswordPayload.message, 'Väärä salasana. Yritä uudelleen.');
    assert.equal(Object.hasOwn(wrongPasswordPayload, 'token'), false);

    const token = await loginToPhp(baseUrl);
    const stateResponse = await fetch(`${baseUrl}/api/state`, { headers: { 'X-SFL-Auth-Token': token } });
    assert.equal(stateResponse.status, 200);
    const state = await stateResponse.json();
    assert.equal(Object.hasOwn(state.settings, 'sitePasswordHash'), false);
    assert.equal(Object.hasOwn(state.settings, 'authSecret'), false);

    const settingsFile = JSON.parse(await readFile(path.join(jsondbDir, 'settings.json'), 'utf8'));
    assert.match(settingsFile.sitePasswordHash, /^\$/);
    assert.equal(Object.hasOwn(settingsFile, 'sitePassword'), false);

    const unauthorizedChange = await fetch(`${baseUrl}/api/site-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'uusi-salasana-123' }),
    });
    assert.equal(unauthorizedChange.status, 401);

    const tooShortChange = await fetch(`${baseUrl}/api/site-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-SFL-Auth-Token': token },
      body: JSON.stringify({ password: 'lyhyt' }),
    });
    assert.equal(tooShortChange.status, 400);

    const changeResponse = await fetch(`${baseUrl}/api/site-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-SFL-Auth-Token': token },
      body: JSON.stringify({ password: 'uusi-salasana-123' }),
    });
    assert.equal(changeResponse.status, 200);

    const oldPasswordResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'sfl-pisteet-2026' }),
    });
    assert.equal(oldPasswordResponse.status, 401);
    await loginToPhp(baseUrl, 'uusi-salasana-123');

    const existingSessionResponse = await fetch(`${baseUrl}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-SFL-Auth-Token': token },
      body: JSON.stringify({ ...state, settings: { ...state.settings, sitePasswordHash: 'x' } }),
    });
    assert.equal(existingSessionResponse.status, 200);

    const settingsAfterSave = JSON.parse(await readFile(path.join(jsondbDir, 'settings.json'), 'utf8'));
    assert.notEqual(settingsAfterSave.sitePasswordHash, 'x');
    await loginToPhp(baseUrl, 'uusi-salasana-123');
  } finally {
    await server.stop();
  }
});

test('PHP API accepts a plain sitePassword from settings.json and upgrades it to a hash', { skip: !hasPhp }, async () => {
  const server = await startPhpServer();
  const { baseUrl, jsondbDir } = server;

  try {
    await writeFile(
      path.join(jsondbDir, 'settings.json'),
      JSON.stringify({ sitePassword: 'kasin-asetettu-1' }),
      'utf8',
    );

    await loginToPhp(baseUrl, 'kasin-asetettu-1');
    const settingsFile = JSON.parse(await readFile(path.join(jsondbDir, 'settings.json'), 'utf8'));
    assert.equal(Object.hasOwn(settingsFile, 'sitePassword'), false);
    assert.match(settingsFile.sitePasswordHash, /^\$/);
    await loginToPhp(baseUrl, 'kasin-asetettu-1');
  } finally {
    await server.stop();
  }
});

test('PHP API appends errors to jsondb/errors.json for authenticated requests', { skip: !hasPhp }, async () => {
  const server = await startPhpServer();
  const { baseUrl, jsondbDir } = server;

  try {
    const payload = {
      source: 'resultCardImport',
      errors: [{ message: 'Virheellinen sijoitus "ABC".', rowNumber: 3, pdgaId: '12345', column: 'T2' }],
    };
    const anonymousResponse = await fetch(`${baseUrl}/api/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(anonymousResponse.status, 401);

    const token = await loginToPhp(baseUrl);
    const headers = { 'Content-Type': 'application/json', 'X-SFL-Auth-Token': token };
    const invalidResponse = await fetch(`${baseUrl}/api/errors`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: 'resultCardImport', errors: [{ message: '' }] }),
    });
    assert.equal(invalidResponse.status, 400);

    for (let index = 0; index < 2; index += 1) {
      const response = await fetch(`${baseUrl}/api/errors`, { method: 'POST', headers, body: JSON.stringify(payload) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { logged: 1 });
    }

    const errors = JSON.parse(await readFile(path.join(jsondbDir, 'errors.json'), 'utf8'));
    assert.equal(errors.length, 2);
    assert.equal(errors[0].source, 'resultCardImport');
    assert.equal(errors[0].message, 'Virheellinen sijoitus "ABC".');
    assert.equal(errors[0].rowNumber, 3);
    assert.equal(errors[0].pdgaId, '12345');
    assert.equal(errors[0].column, 'T2');
    assert.match(errors[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await server.stop();
  }
});

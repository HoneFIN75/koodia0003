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

test('PHP API supports state save/load and compatibility payloads', { skip: !hasPhp }, async () => {
  const jsondbDir = await mkdtemp(path.join(os.tmpdir(), 'sfl-php-jsondb-'));
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sfl-php-router-'));
  const routerPath = path.join(tempDir, 'router.php');
  const apiIndexPath = path.join(rootDir, 'api', 'index.php').replaceAll('\\', '\\\\');
  await writeFile(routerPath, `<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/api/state') {
    $_GET['endpoint'] = 'state';
    require '${apiIndexPath}';
    return true;
}
if ($path === '/api/health') {
    $_GET['endpoint'] = 'health';
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

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/health`);

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
      },
      body: JSON.stringify(fullStatePayload),
    });
    assert.equal(saveResponse.status, 200);

    const invalidJsonResponse = await fetch(`http://127.0.0.1:${port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"players":',
    });
    assert.equal(invalidJsonResponse.status, 400);
    assert.match(await invalidJsonResponse.text(), /Pyynnön JSON-data on virheellinen\./);

    const incompleteResponse = await fetch(`http://127.0.0.1:${port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ players: [] }),
    });
    assert.equal(incompleteResponse.status, 400);
    assert.match(await incompleteResponse.text(), /Tallennettava tila on puutteellinen\./);

    const compatibilityResponse = await fetch(`http://127.0.0.1:${port}/api/state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
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
    serverProcess.kill('SIGTERM');
    await rm(jsondbDir, { recursive: true, force: true });
    await rm(tempDir, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  const port = await getFreePort();
  const serverProcess = spawn('php', ['-S', `127.0.0.1:${port}`], {
    cwd: rootDir,
    env: {
      ...process.env,
      SFL_JSONDB_PATH: jsondbDir,
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/index.php?endpoint=health`);

    const fullStatePayload = {
      players: [],
      tournaments: [],
      resultCards: [],
      settings: {},
      pointsTable: { MPO: {}, FPO: {} },
      multipliers: [],
    };

    const saveResponse = await fetch(`http://127.0.0.1:${port}/api/index.php?endpoint=state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullStatePayload),
    });
    assert.equal(saveResponse.status, 200);

    const invalidJsonResponse = await fetch(`http://127.0.0.1:${port}/api/index.php?endpoint=state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"players":',
    });
    assert.equal(invalidJsonResponse.status, 400);
    assert.match(await invalidJsonResponse.text(), /Pyynnön JSON-data on virheellinen\./);

    const incompleteResponse = await fetch(`http://127.0.0.1:${port}/api/index.php?endpoint=state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ players: [] }),
    });
    assert.equal(incompleteResponse.status, 400);
    assert.match(await incompleteResponse.text(), /Tallennettava tila on puutteellinen\./);

    const compatibilityResponse = await fetch(`http://127.0.0.1:${port}/api/index.php?endpoint=state`, {
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
  }
});

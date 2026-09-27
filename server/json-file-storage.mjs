import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createEmptyState, sanitizeState } from '../js/storage.js';

const STORAGE_FILES = {
  players: 'players.json',
  tournaments: 'tournaments.json',
  tournamentResults: 'tournamentResults.json',
  scoreTables: 'scoreTables.json',
  multipliers: 'multipliers.json',
  settings: 'settings.json',
};

async function writeJsonAtomically(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      await writeJsonAtomically(filePath, fallbackValue);
      return fallbackValue;
    }
    throw error;
  }
}

export class JsonFileStorage {
  constructor({ directoryPath }) {
    this.directoryPath = directoryPath;
    this.ensurePromise = null;
    this.pendingSave = Promise.resolve();
  }

  async ensureInitialized() {
    if (!this.ensurePromise) {
      this.ensurePromise = this.#ensureInitialized();
    }

    await this.ensurePromise;
  }

  async #ensureInitialized() {
    const defaultState = createEmptyState();
    await mkdir(this.directoryPath, { recursive: true });

    await Promise.all([
      readJsonFile(this.#resolvePath(STORAGE_FILES.players), defaultState.players),
      readJsonFile(this.#resolvePath(STORAGE_FILES.tournaments), defaultState.tournaments),
      readJsonFile(this.#resolvePath(STORAGE_FILES.tournamentResults), defaultState.tournamentResults),
      readJsonFile(this.#resolvePath(STORAGE_FILES.scoreTables), defaultState.pointsTable),
      readJsonFile(this.#resolvePath(STORAGE_FILES.multipliers), defaultState.multipliers),
      readJsonFile(this.#resolvePath(STORAGE_FILES.settings), defaultState.settings),
    ]);
  }

  async loadState() {
    await this.ensureInitialized();

    const [
      players,
      tournaments,
      tournamentResults,
      pointsTable,
      multipliers,
      settings,
    ] = await Promise.all([
      readJsonFile(this.#resolvePath(STORAGE_FILES.players), []),
      readJsonFile(this.#resolvePath(STORAGE_FILES.tournaments), []),
      readJsonFile(this.#resolvePath(STORAGE_FILES.tournamentResults), []),
      readJsonFile(this.#resolvePath(STORAGE_FILES.scoreTables), createEmptyState().pointsTable),
      readJsonFile(this.#resolvePath(STORAGE_FILES.multipliers), createEmptyState().multipliers),
      readJsonFile(this.#resolvePath(STORAGE_FILES.settings), createEmptyState().settings),
    ]);

    return sanitizeState({
      players,
      tournaments,
      tournamentResults,
      pointsTable,
      multipliers,
      settings,
    });
  }

  async saveState(state) {
    await this.ensureInitialized();
    const sanitized = sanitizeState(state);

    const persistState = async () => {
      await Promise.all([
        writeJsonAtomically(this.#resolvePath(STORAGE_FILES.players), sanitized.players),
        writeJsonAtomically(this.#resolvePath(STORAGE_FILES.tournaments), sanitized.tournaments),
        writeJsonAtomically(this.#resolvePath(STORAGE_FILES.tournamentResults), sanitized.tournamentResults),
        writeJsonAtomically(this.#resolvePath(STORAGE_FILES.scoreTables), sanitized.pointsTable),
        writeJsonAtomically(this.#resolvePath(STORAGE_FILES.multipliers), sanitized.multipliers),
        writeJsonAtomically(this.#resolvePath(STORAGE_FILES.settings), sanitized.settings),
      ]);

      return sanitized;
    };

    const savePromise = this.pendingSave.then(persistState, persistState);
    this.pendingSave = savePromise.catch(() => {});
    return savePromise;
  }

  #resolvePath(fileName) {
    return path.join(this.directoryPath, fileName);
  }
}

export function createJsonFileStorage(options) {
  return new JsonFileStorage(options);
}

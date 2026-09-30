import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createEmptyState, sanitizeState } from '../js/storage.js';
import { pickSiteAuthSettings, readSettingsFile, withSettingsFileLock } from './site-auth.mjs';

const STORAGE_FILES = {
  snapshot: 'state.json',
  players: 'players.json',
  tournaments: 'tournaments.json',
  resultCards: 'resultCards.json',
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

    const snapshot = sanitizeState(
      await readJsonFile(this.#resolvePath(STORAGE_FILES.snapshot), defaultState),
    );
    await this.#syncSlices(snapshot);
  }

  async loadState() {
    await this.ensureInitialized();
    const snapshot = sanitizeState(
      await readJsonFile(this.#resolvePath(STORAGE_FILES.snapshot), createEmptyState()),
    );
    await this.#syncSlices(snapshot);
    return snapshot;
  }

  async saveState(state) {
    await this.ensureInitialized();
    const sanitized = sanitizeState(state);

    const persistState = async () => {
      await writeJsonAtomically(this.#resolvePath(STORAGE_FILES.snapshot), sanitized);
      await this.#syncSlices(sanitized);

      return sanitized;
    };

    const savePromise = this.pendingSave.then(persistState, persistState);
    this.pendingSave = savePromise.catch(() => {});
    return savePromise;
  }

  #resolvePath(fileName) {
    return path.join(this.directoryPath, fileName);
  }

  async #syncSlices(state) {
    await Promise.all([
      writeJsonAtomically(this.#resolvePath(STORAGE_FILES.players), state.players),
      writeJsonAtomically(this.#resolvePath(STORAGE_FILES.tournaments), state.tournaments),
      writeJsonAtomically(this.#resolvePath(STORAGE_FILES.resultCards), state.resultCards),
      writeJsonAtomically(this.#resolvePath(STORAGE_FILES.scoreTables), state.pointsTable),
      writeJsonAtomically(this.#resolvePath(STORAGE_FILES.multipliers), state.multipliers),
      withSettingsFileLock(this.directoryPath, async () => {
        const siteAuthSettings = pickSiteAuthSettings(await readSettingsFile(this.directoryPath));
        await writeJsonAtomically(this.#resolvePath(STORAGE_FILES.settings), { ...state.settings, ...siteAuthSettings });
      }),
    ]);
  }
}

export function createJsonFileStorage(options) {
  return new JsonFileStorage(options);
}

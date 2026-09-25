const STORAGE_KEY = 'sfl-pisteytystyokalu:v1';
const STORAGE_VERSION = 1;

export function createEmptyState() {
  return {
    version: STORAGE_VERSION,
    players: [],
    tournaments: [],
    tournamentResults: [],
    pointsTable: {
      MPO: {},
      FPO: {},
    },
  };
}

function getLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function sanitizePointsTable(pointsTable = {}) {
  return {
    MPO: { ...(pointsTable.MPO || {}) },
    FPO: { ...(pointsTable.FPO || {}) },
  };
}

function sanitizeState(candidate = {}) {
  const empty = createEmptyState();

  return {
    version: STORAGE_VERSION,
    players: Array.isArray(candidate.players) ? candidate.players : empty.players,
    tournaments: Array.isArray(candidate.tournaments) ? candidate.tournaments : empty.tournaments,
    tournamentResults: Array.isArray(candidate.tournamentResults)
      ? candidate.tournamentResults
      : empty.tournamentResults,
    pointsTable: sanitizePointsTable(candidate.pointsTable),
  };
}

export function loadState() {
  const storage = getLocalStorage();
  if (!storage) {
    return createEmptyState();
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    const empty = createEmptyState();
    storage.setItem(STORAGE_KEY, JSON.stringify(empty));
    return empty;
  }

  try {
    const parsed = JSON.parse(raw);
    return sanitizeState(parsed);
  } catch {
    throw new Error('Tallennetun datan lukeminen epäonnistui. Tyhjennä selaintiedot ja lataa sivu uudelleen.');
  }
}

export function saveState(state) {
  const storage = getLocalStorage();
  const sanitized = sanitizeState(state);
  if (!storage) {
    return sanitized;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export function resetState() {
  const storage = getLocalStorage();
  const empty = createEmptyState();
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(empty));
  }

  return empty;
}

export function getStorageMeta() {
  return {
    key: STORAGE_KEY,
    version: STORAGE_VERSION,
    mode: 'localStorage',
    hasDemoEmptyState: true,
  };
}

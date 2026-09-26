import { DEFAULT_TOURNAMENT_DISPLAY_ORDER } from './tournaments.js';
import { DEFAULT_PDGA_SETTINGS, extractPdgaEventId, extractPdgaPlayerId, sanitizePdgaSettings } from './pdga.js';

const STORAGE_KEY = 'sfl-pisteytystyokalu:v2';
const LEGACY_STORAGE_KEYS = ['sfl-pisteytystyokalu:v1'];
const STORAGE_VERSION = 2;

export function createEmptyState() {
  return {
    version: STORAGE_VERSION,
    players: [],
    tournaments: [],
    tournamentResults: [],
    settings: { ...DEFAULT_PDGA_SETTINGS },
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

function sanitizePlayer(player = {}) {
  const pdgaNumber = extractPdgaPlayerId(player.pdgaNumber) || extractPdgaPlayerId(player.pdgaProfileUrl);

  return {
    id: player.id,
    name: player.name,
    division: player.division,
    pdgaNumber,
    pdgaRating: player.pdgaRating,
    worldRank: player.worldRank,
    notes: player.notes,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  };
}

function sanitizeTournament(tournament = {}) {
  const parsedDisplayOrder = Number(tournament.displayOrder);
  const pdgaEventId =
    extractPdgaEventId(tournament.pdgaEventId) ||
    extractPdgaEventId(tournament.pdgaEventUrl) ||
    extractPdgaEventId(tournament.externalUrl);

  return {
    id: tournament.id,
    name: tournament.name,
    pdgaEventId,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    displayOrder: Number.isInteger(parsedDisplayOrder) && parsedDisplayOrder > 0
      ? parsedDisplayOrder
      : DEFAULT_TOURNAMENT_DISPLAY_ORDER,
    location: tournament.location,
    venue: tournament.venue,
    status: tournament.status,
    multiplierKey: tournament.multiplierKey,
    multiplier: tournament.multiplier,
    division: tournament.division,
    externalUrl: tournament.externalUrl,
    notes: tournament.notes,
    createdAt: tournament.createdAt,
    updatedAt: tournament.updatedAt,
  };
}

function sanitizeState(candidate = {}) {
  const empty = createEmptyState();

  return {
    version: STORAGE_VERSION,
    players: Array.isArray(candidate.players) ? candidate.players.map(sanitizePlayer) : empty.players,
    tournaments: Array.isArray(candidate.tournaments) ? candidate.tournaments.map(sanitizeTournament) : empty.tournaments,
    tournamentResults: Array.isArray(candidate.tournamentResults)
      ? candidate.tournamentResults
      : empty.tournamentResults,
    settings: sanitizePdgaSettings(candidate.settings),
    pointsTable: sanitizePointsTable(candidate.pointsTable),
  };
}

export function loadState() {
  const storage = getLocalStorage();
  if (!storage) {
    return createEmptyState();
  }

  const raw = storage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => storage.getItem(key)).find(Boolean);
  if (!raw) {
    const empty = createEmptyState();
    storage.setItem(STORAGE_KEY, JSON.stringify(empty));
    return empty;
  }

  try {
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeState(parsed);
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
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

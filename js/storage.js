import { DEFAULT_TOURNAMENT_DISPLAY_ORDER } from './tournaments.js';
import { DEFAULT_PDGA_SETTINGS, extractPdgaEventId, extractPdgaPlayerId, sanitizePdgaSettings } from './pdga.js';
import { createDefaultMultipliers, ensureLegacyMultiplier, sanitizeMultipliers } from './multipliers.js';

const STORAGE_KEY = 'sfl-pisteytystyokalu:v3';
const LEGACY_STORAGE_KEYS = ['sfl-pisteytystyokalu:v2', 'sfl-pisteytystyokalu:v1'];
const STORAGE_VERSION = 3;

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
    multipliers: createDefaultMultipliers(),
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
  const normalizedName = String(player.name || '').trim();
  const [fallbackFirstName = '', ...fallbackLastNameParts] = normalizedName.split(/\s+/);
  const firstName = String(player.firstName || fallbackFirstName).trim();
  const lastName = String(player.lastName || fallbackLastNameParts.join(' ')).trim();
  const name = String(player.name || `${firstName} ${lastName}`).trim();

  return {
    id: player.id,
    firstName,
    lastName,
    name,
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
    multiplierId: tournament.multiplierId,
    division: tournament.division,
    externalUrl: tournament.externalUrl,
    notes: tournament.notes,
    createdAt: tournament.createdAt,
    updatedAt: tournament.updatedAt,
    legacyStatus: tournament.status,
    legacyMultiplierKey: tournament.multiplierKey,
    legacyMultiplier: tournament.multiplier,
  };
}

function sanitizeState(candidate = {}) {
  const empty = createEmptyState();
  const sanitizedTournaments = Array.isArray(candidate.tournaments)
    ? candidate.tournaments.map(sanitizeTournament)
    : empty.tournaments;
  let sanitizedMultipliers = sanitizeMultipliers(candidate.multipliers);

  const migratedTournaments = sanitizedTournaments.map((tournament) => {
    let multiplierId = String(tournament.multiplierId || '').trim();
    if (!multiplierId || !sanitizedMultipliers.some((entry) => entry.id === multiplierId)) {
      const migration = ensureLegacyMultiplier(sanitizedMultipliers, {
        status: tournament.legacyStatus,
        multiplierKey: tournament.legacyMultiplierKey,
        multiplier: tournament.legacyMultiplier,
      });
      sanitizedMultipliers = migration.multipliers;
      multiplierId = migration.multiplierId;
    }

    return {
      id: tournament.id,
      name: tournament.name,
      pdgaEventId: tournament.pdgaEventId,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      displayOrder: tournament.displayOrder,
      location: tournament.location,
      venue: tournament.venue,
      multiplierId,
      division: tournament.division,
      externalUrl: tournament.externalUrl,
      notes: tournament.notes,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
    };
  });

  return {
    version: STORAGE_VERSION,
    players: Array.isArray(candidate.players) ? candidate.players.map(sanitizePlayer) : empty.players,
    tournaments: migratedTournaments,
    tournamentResults: Array.isArray(candidate.tournamentResults)
      ? candidate.tournamentResults
      : empty.tournamentResults,
    settings: sanitizePdgaSettings(candidate.settings),
    pointsTable: sanitizePointsTable(candidate.pointsTable),
    multipliers: sanitizedMultipliers,
  };
}

function hasStateData(state) {
  const defaultState = createEmptyState();

  return (
    state.players.length > 0 ||
    state.tournaments.length > 0 ||
    state.tournamentResults.length > 0 ||
    Object.keys(state.pointsTable.MPO).length > 0 ||
    Object.keys(state.pointsTable.FPO).length > 0 ||
    state.settings.playerBaseUrl !== DEFAULT_PDGA_SETTINGS.playerBaseUrl ||
    state.settings.eventBaseUrl !== DEFAULT_PDGA_SETTINGS.eventBaseUrl ||
    JSON.stringify(state.multipliers) !== JSON.stringify(defaultState.multipliers)
  );
}

export function loadState() {
  const storage = getLocalStorage();
  if (!storage) {
    return createEmptyState();
  }

  const currentRaw = storage.getItem(STORAGE_KEY);
  const legacyRaw = LEGACY_STORAGE_KEYS.map((key) => storage.getItem(key)).find(Boolean);
  if (!currentRaw && !legacyRaw) {
    const empty = createEmptyState();
    storage.setItem(STORAGE_KEY, JSON.stringify(empty));
    return empty;
  }

  try {
    const currentState = currentRaw ? sanitizeState(JSON.parse(currentRaw)) : null;
    const legacyState = legacyRaw ? sanitizeState(JSON.parse(legacyRaw)) : null;
    const sanitized = (
      currentState && (!legacyState || hasStateData(currentState) || !hasStateData(legacyState))
        ? currentState
        : legacyState
    ) || createEmptyState();

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

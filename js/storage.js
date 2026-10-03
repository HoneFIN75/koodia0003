import { DEFAULT_TOURNAMENT_DISPLAY_ORDER, normalizeTournamentContinent } from './tournaments.js';
import { DEFAULT_PDGA_SETTINGS, extractPdgaEventId, extractPdgaPlayerId, sanitizePdgaSettings } from './pdga.js';
import { AuthRequiredError, getAuthHeaders } from './auth.js';
import { createDefaultMultipliers, ensureLegacyMultiplier, sanitizeMultipliers } from './multipliers.js';

export const STORAGE_VERSION = 5;

function createDefaultPointsTable() {
  return {
    MPO: {},
    FPO: {},
  };
}

export function createEmptyState() {
  return {
    version: STORAGE_VERSION,
    players: [],
    tournaments: [],
    resultCards: [],
    settings: { ...DEFAULT_PDGA_SETTINGS },
    pointsTable: createDefaultPointsTable(),
    multipliers: createDefaultMultipliers(),
  };
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
  const rawPdgaEventId = String(tournament.pdgaEventId ?? '').trim();
  const pdgaEventId =
    rawPdgaEventId === '000000'
      ? '000000'
      : extractPdgaEventId(tournament.pdgaEventId) ||
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
    continent: normalizeTournamentContinent(tournament.continent) || '',
    externalUrl: tournament.externalUrl,
    notes: tournament.notes,
    createdAt: tournament.createdAt,
    updatedAt: tournament.updatedAt,
    legacyStatus: tournament.status,
    legacyMultiplierKey: tournament.multiplierKey,
    legacyMultiplier: tournament.multiplier,
  };
}

function normalizeId(value) {
  return String(value ?? '').trim();
}

// Tuloskortit ovat pelaajakohtaisia ja sisältävät vain sijoitukset turnauksittain.
// Vanhat turnauskohtaiset tuloskortit ja tournamentResults-rivit migroidaan tähän malliin.
// Mahdolliset tallennetut pisteet, kertoimet tai muut snapshot-arvot jätetään pois.
function sanitizeResultCards(resultCards, legacyTournamentResults) {
  const cardByPlayerId = new Map();

  const addEntry = (playerId, tournamentId, placement, meta = {}) => {
    const safePlayerId = normalizeId(playerId);
    const safeTournamentId = normalizeId(tournamentId);
    const safePlacement = String(placement ?? '').trim().toUpperCase();
    if (!safePlayerId || !safeTournamentId || !safePlacement) {
      return;
    }

    let card = cardByPlayerId.get(safePlayerId);
    if (!card) {
      card = {
        id: normalizeId(meta.id) || `result-card-${safePlayerId}`,
        playerId: safePlayerId,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        results: [],
      };
      cardByPlayerId.set(safePlayerId, card);
    }

    if (card.results.some((entry) => entry.tournamentId === safeTournamentId)) {
      return;
    }

    card.results.push({ tournamentId: safeTournamentId, placement: safePlacement });
  };

  if (Array.isArray(resultCards)) {
    resultCards.forEach((card = {}) => {
      if (!Array.isArray(card?.results)) {
        // Vanha litteä tournamentResults-rivi (esim. PHP-API:n varapolusta).
        addEntry(card?.playerId, card?.tournamentId, card?.placement ?? card?.place, {
          createdAt: card?.createdAt,
          updatedAt: card?.updatedAt,
        });
        return;
      }

      const results = card.results;
      if (card?.playerId) {
        results.forEach((result) => addEntry(card.playerId, result?.tournamentId, result?.placement, card));
        return;
      }

      results.forEach((result) =>
        addEntry(result?.playerId, card?.tournamentId, result?.placement, {
          createdAt: card?.createdAt,
          updatedAt: card?.updatedAt,
        }),
      );
    });
  } else if (Array.isArray(legacyTournamentResults)) {
    legacyTournamentResults.forEach((result = {}) =>
      addEntry(result?.playerId, result?.tournamentId, result?.placement ?? result?.place, {
        createdAt: result?.createdAt,
        updatedAt: result?.updatedAt,
      }),
    );
  }

  return [...cardByPlayerId.values()];
}

export function sanitizeState(candidate = {}) {
  const empty = createEmptyState();
  const sanitizedPlayers = Array.isArray(candidate.players) ? candidate.players.map(sanitizePlayer) : empty.players;
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
      continent: tournament.continent,
      externalUrl: tournament.externalUrl,
      notes: tournament.notes,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
    };
  });

  return {
    version: STORAGE_VERSION,
    players: sanitizedPlayers,
    tournaments: migratedTournaments,
    resultCards: sanitizeResultCards(candidate.resultCards, candidate.tournamentResults),
    settings: sanitizePdgaSettings(candidate.settings),
    pointsTable: sanitizePointsTable(candidate.pointsTable),
    multipliers: sanitizedMultipliers,
  };
}

function getStateApiUrl(moduleUrl = import.meta.url) {
  return new URL('../api/state', moduleUrl);
}

async function readErrorMessage(response, fallbackMessage) {
  try {
    const payload = await response.json();
    if (payload && typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
  } catch {
    // Fall back to generic message below.
  }

  return fallbackMessage;
}

export async function loadState({
  fetchImpl = globalThis.fetch,
  moduleUrl = import.meta.url,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Tietojen lataaminen epäonnistui. Käynnistä sovellus palvelimen kautta ja yritä uudelleen.');
  }

  let response;
  try {
    response = await fetchImpl(getStateApiUrl(moduleUrl), {
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Tietojen lataaminen epäonnistui palvelimelta. Yritä uudelleen hetken kuluttua.');
  }

  if (response.status === 401) {
    throw new AuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Tietojen lataaminen epäonnistui palvelimelta.'));
  }

  try {
    return sanitizeState(await response.json());
  } catch {
    throw new Error('Palvelimen vastausta ei voitu lukea.');
  }
}

export async function saveState(
  state,
  {
    fetchImpl = globalThis.fetch,
    moduleUrl = import.meta.url,
  } = {},
) {
  const sanitized = sanitizeState(state);

  if (typeof fetchImpl !== 'function') {
    throw new Error('Tallentaminen epäonnistui. Käynnistä sovellus palvelimen kautta ja yritä uudelleen.');
  }

  let response;
  try {
    response = await fetchImpl(getStateApiUrl(moduleUrl), {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(sanitized),
    });
  } catch {
    throw new Error('Tallentaminen epäonnistui palvelimelle. Yritä uudelleen hetken kuluttua.');
  }

  if (response.status === 401) {
    throw new AuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Tallentaminen epäonnistui palvelimelle.'));
  }

  try {
    return sanitizeState(await response.json());
  } catch {
    throw new Error('Palvelimen vastausta ei voitu lukea.');
  }
}

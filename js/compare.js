import { searchPlayers } from './players.js';
import { sortTournaments } from './tournaments.js';
import { findMultiplier } from './multipliers.js';
import { buildRanking } from './ranking.js';
import { getPlayerPlacement } from './results.js';
import { parsePlacement } from './scoring.js';

// Vertaile-sivu on lukunäkymä: se kokoaa valittujen pelaajien sijoitukset turnauksittain.
// Sijoitukset luetaan tuloskorteilta sellaisenaan (esim. 3T4), eikä niitä muuteta.

export const COMPARE_SEARCH_MIN_LENGTH = 3;
export const COMPARE_SUGGESTION_LIMIT = 8;

export function searchComparePlayers(players = [], query, { selectedPlayerIds = [], limit = COMPARE_SUGGESTION_LIMIT } = {}) {
  const normalizedQuery = String(query ?? '').trim();
  if (normalizedQuery.length < COMPARE_SEARCH_MIN_LENGTH) {
    return [];
  }

  const selected = new Set(selectedPlayerIds);
  return searchPlayers(players, normalizedQuery)
    .filter((player) => !selected.has(player.id))
    .slice(0, limit);
}

export function getComparePlayers(players = [], playerIds = []) {
  return playerIds
    .map((playerId) => players.find((player) => player.id === playerId))
    .filter(Boolean);
}

export function buildComparePlayerSummaries(dataState, playerIds = []) {
  const ranking = buildRanking(dataState);
  const rankingById = new Map(ranking.map((entry) => [entry.id, entry]));

  return getComparePlayers(dataState.players || [], playerIds).map((player) => {
    const aggregate = rankingById.get(player.id) || { tournamentCount: 0, totalPoints: 0 };
    return {
      ...player,
      tournamentCount: aggregate.tournamentCount,
      totalPoints: aggregate.totalPoints,
    };
  });
}

function getPlacementSortValue(placement) {
  try {
    const parsed = parsePlacement(placement);
    return parsed ? parsed.place : null;
  } catch {
    return null;
  }
}

export function buildCompareRows(dataState, playerIds = [], { hideEmptyTournaments = false } = {}) {
  const resultCards = dataState.resultCards || [];
  const multipliers = dataState.multipliers || [];
  const players = getComparePlayers(dataState.players || [], playerIds);

  const rows = sortTournaments(dataState.tournaments || []).map((tournament) => {
    const multiplier = findMultiplier(multipliers, tournament.multiplierId);
    const placements = players.map((player) => ({
      playerId: player.id,
      name: player.name,
      placement: getPlayerPlacement(resultCards, player.id, tournament.id),
    }));

    const bestValue = placements.reduce((best, entry) => {
      const value = getPlacementSortValue(entry.placement);
      if (value === null) {
        return best;
      }

      return best === null || value < best ? value : best;
    }, null);

    return {
      tournament,
      multiplier,
      hasResults: placements.some((entry) => Boolean(entry.placement)),
      placements: placements.map((entry) => ({
        ...entry,
        isBest: bestValue !== null && getPlacementSortValue(entry.placement) === bestValue,
      })),
    };
  });

  return hideEmptyTournaments ? rows.filter((row) => row.hasResults) : rows;
}

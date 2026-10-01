import {
  DIVISIONS,
  calculateResultPoints,
  isNonParticipationPlacement,
  listResultEntries,
  parsePlacement,
  tryCalculateResultPoints,
  validatePlacementAgainstOthers,
} from './scoring.js';
import { sortTournaments } from './tournaments.js';

// Tuloskortti on pelaajakohtainen: { id, playerId, createdAt, updatedAt, results: [{ tournamentId, placement }] }.
// Kortille tallennetaan vain sijoitus. Pisteet lasketaan aina scoring.js:n kautta nykyisistä perustiedoista.

export function createResultCardId(playerId) {
  return `result-card-${playerId}`;
}

export function normalizePlacementInput(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function findPlayerResultCard(resultCards = [], playerId) {
  return resultCards.find((card) => card.playerId === playerId) || null;
}

export function getPlayerPlacement(resultCards = [], playerId, tournamentId) {
  const card = findPlayerResultCard(resultCards, playerId);
  const result = (card?.results || []).find((entry) => entry.tournamentId === tournamentId);
  return result ? String(result.placement ?? '') : '';
}

function listTournamentPlacementsForDivision({ resultCards, players, tournamentId, division, excludePlayerId }) {
  const playerById = new Map(players.map((player) => [player.id, player]));

  return listResultEntries(resultCards)
    .filter((entry) => entry.tournamentId === tournamentId && entry.playerId !== excludePlayerId)
    .map((entry) => ({ ...entry, player: playerById.get(entry.playerId) }))
    .filter((entry) => entry.player && entry.player.division === division)
    .map((entry) => ({ playerId: entry.playerId, name: entry.player.name, placement: entry.placement }));
}

function writePlacement(resultCards, playerId, tournamentId, placement, now) {
  const existingCard = findPlayerResultCard(resultCards, playerId);
  const remainingResults = (existingCard?.results || []).filter((entry) => entry.tournamentId !== tournamentId);
  const nextResults = placement ? [...remainingResults, { tournamentId, placement }] : remainingResults;

  if (!existingCard) {
    if (!placement) {
      return resultCards;
    }

    return [
      ...resultCards,
      {
        id: createResultCardId(playerId),
        playerId,
        createdAt: now,
        updatedAt: now,
        results: nextResults,
      },
    ];
  }

  return resultCards.map((card) => (
    card === existingCard
      ? { ...card, results: nextResults, updatedAt: now }
      : card
  ));
}

// Validoi ja asettaa pelaajan sijoituksen turnaukseen. Heittää virheen, jos sijoitus on virheellinen,
// menee päällekkäin toisen saman sarjan pelaajan kanssa tai pisteitä ei voida laskea
// (esim. pistetaulukon arvo tai turnauksen kerroin puuttuu). Tällöin tulosta ei tallenneta.
export function setPlayerPlacement(dataState, { playerId, tournamentId, placement, now = new Date().toISOString() }) {
  const resultCards = dataState.resultCards || [];
  const players = dataState.players || [];
  const player = players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error('Pelaajaa ei löytynyt.');
  }

  const tournament = (dataState.tournaments || []).find((entry) => entry.id === tournamentId);
  if (!tournament) {
    throw new Error('Turnausta ei löytynyt.');
  }

  const previousPlacement = getPlayerPlacement(resultCards, playerId, tournamentId);
  const normalizedInput = normalizePlacementInput(placement);
  if (!normalizedInput) {
    return {
      changed: previousPlacement !== '',
      placement: '',
      points: null,
      resultCards: previousPlacement ? writePlacement(resultCards, playerId, tournamentId, '', now) : resultCards,
    };
  }

  if (isNonParticipationPlacement(normalizedInput)) {
    return {
      changed: normalizedInput !== previousPlacement,
      placement: normalizedInput,
      points: null,
      resultCards: normalizedInput !== previousPlacement
        ? writePlacement(resultCards, playerId, tournamentId, normalizedInput, now)
        : resultCards,
    };
  }

  const parsed = validatePlacementAgainstOthers({
    placement: normalizedInput,
    others: listTournamentPlacementsForDivision({
      resultCards,
      players,
      tournamentId,
      division: player.division,
      excludePlayerId: playerId,
    }),
  });
  const points = calculateResultPoints({
    placement: parsed.raw,
    player,
    tournament,
    pointsTable: dataState.pointsTable,
    multipliers: dataState.multipliers || [],
  });

  if (parsed.raw === previousPlacement) {
    return { changed: false, placement: parsed.raw, points, resultCards };
  }

  return {
    changed: true,
    placement: parsed.raw,
    points,
    resultCards: writePlacement(resultCards, playerId, tournamentId, parsed.raw, now),
  };
}

// Kirjoittaa sijoituksen sellaisenaan ilman validointia. Käytetään vain jo aiemmin tallennetun
// arvon palauttamiseen (esim. tuloskorttien massatuonnissa hylätyn muutoksen peruminen).
export function restorePlayerPlacement(resultCards = [], playerId, tournamentId, placement, now = new Date().toISOString()) {
  return writePlacement(resultCards, playerId, tournamentId, normalizePlacementInput(placement), now);
}

export function clearPlayerPlacement(resultCards = [], playerId, tournamentId, now = new Date().toISOString()) {
  return writePlacement(resultCards, playerId, tournamentId, '', now);
}

export function removeTournamentFromResultCards(resultCards = [], tournamentId) {
  return resultCards.map((card) => ({
    ...card,
    results: (card.results || []).filter((entry) => entry.tournamentId !== tournamentId),
  }));
}

export function removePlayerResultCard(resultCards = [], playerId) {
  return resultCards.filter((card) => card.playerId !== playerId);
}

export function countResults(resultCards = [], { playerId = null, tournamentId = null } = {}) {
  return listResultEntries(resultCards).filter(
    (entry) => (playerId === null || entry.playerId === playerId) && (tournamentId === null || entry.tournamentId === tournamentId),
  ).length;
}

export function getBestTournamentResults(dataState, tournamentId) {
  const playerById = new Map((dataState.players || []).map((player) => [player.id, player]));
  const best = Object.fromEntries(DIVISIONS.map((division) => [division, null]));

  listResultEntries(dataState.resultCards || [])
    .filter((entry) => entry.tournamentId === tournamentId)
    .forEach((entry) => {
      const player = playerById.get(entry.playerId);
      if (!player || !DIVISIONS.includes(player.division)) {
        return;
      }

      let parsed;
      try {
        parsed = parsePlacement(entry.placement);
      } catch {
        return;
      }
      if (!parsed) {
        return;
      }

      const current = best[player.division];
      if (!current || parsed.place < current.place) {
        best[player.division] = { place: parsed.place, placement: parsed.raw, names: [player.name] };
      } else if (parsed.place === current.place) {
        current.names.push(player.name);
      }
    });

  DIVISIONS.forEach((division) => {
    best[division]?.names.sort((left, right) => left.localeCompare(right, 'fi'));
  });

  return best;
}

const PODIUM_MEDALS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

// Mitali määräytyy näytettävän sijoituksen ensimmäisestä numerosta: 1T2 → kulta, 3T4 → pronssi.
export function getPlacementMedal(placement) {
  let parsed;
  try {
    parsed = parsePlacement(placement);
  } catch {
    return null;
  }

  return parsed ? PODIUM_MEDALS[parsed.place] || null : null;
}

// Turnauksen tuloskortin sarjakohtaiset tulokset kilpailujärjestyksessä (sijoitus nousevasti,
// tasatuloksissa nimen mukaan). Palauttaa vain sarjat, joilla on vähintään yksi tulos.
export function buildTournamentStandings(dataState, tournamentId) {
  const playerById = new Map((dataState.players || []).map((player) => [player.id, player]));
  const standings = Object.fromEntries(DIVISIONS.map((division) => [division, []]));

  listResultEntries(dataState.resultCards || [])
    .filter((entry) => entry.tournamentId === tournamentId)
    .forEach((entry) => {
      const player = playerById.get(entry.playerId);
      if (!player || !DIVISIONS.includes(player.division)) {
        return;
      }

      let parsed;
      try {
        parsed = parsePlacement(entry.placement);
      } catch {
        return;
      }
      if (!parsed) {
        return;
      }

      standings[player.division].push({
        playerId: player.id,
        name: player.name,
        placement: parsed.raw,
        place: parsed.place,
        medal: PODIUM_MEDALS[parsed.place] || null,
      });
    });

  return DIVISIONS
    .map((division) => ({
      division,
      rows: standings[division].sort(
        (left, right) => left.place - right.place || left.name.localeCompare(right.name, 'fi'),
      ),
    }))
    .filter((entry) => entry.rows.length > 0);
}

export function formatBestResult(bestResult) {
  if (!bestResult) {
    return '-';
  }

  return `${bestResult.placement} ${bestResult.names.join(', ')}`;
}

export function getPlayerResultRow(dataState, playerId, tournament) {
  const player = (dataState.players || []).find((entry) => entry.id === playerId) || null;
  const placement = getPlayerPlacement(dataState.resultCards || [], playerId, tournament?.id);

  return {
    tournament,
    placement,
    calculatedPoints: placement
      ? tryCalculateResultPoints({
          placement,
          player,
          tournament,
          pointsTable: dataState.pointsTable,
          multipliers: dataState.multipliers || [],
        })
      : null,
  };
}

export function buildPlayerResultCardRows(dataState, playerId) {
  return sortTournaments(dataState.tournaments || []).map((tournament) => getPlayerResultRow(dataState, playerId, tournament));
}

export const DIVISIONS = ['MPO', 'FPO'];
import { findMultiplier } from './multipliers.js';

function createId(prefix = 'result') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function normalizeDivision(division) {
  const normalized = String(division ?? '').trim().toUpperCase();
  if (!DIVISIONS.includes(normalized)) {
    throw new Error('Sarjan pitää olla MPO tai FPO.');
  }

  return normalized;
}

function normalizePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} pitää olla positiivinen kokonaisluku.`);
  }

  return parsed;
}

function normalizeDecimalInput(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');
}

function normalizeNonNegativeNumber(value, label) {
  const normalizedValue = normalizeDecimalInput(value);
  if (normalizedValue === '') {
    throw new Error(`${label} pitää olla nolla tai positiivinen luku.`);
  }

  const parsed = Number(normalizedValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} pitää olla nolla tai positiivinen luku.`);
  }

  return parsed;
}

export function createEmptyPointsTable() {
  return {
    MPO: {},
    FPO: {},
  };
}

export function upsertPointsTableEntry(pointsTable, input) {
  const division = normalizeDivision(input.division);
  const place = normalizePositiveInteger(input.place, 'Sijoituksen');
  const basePoints = normalizeNonNegativeNumber(input.basePoints, 'Peruspisteiden');

  return {
    ...pointsTable,
    [division]: {
      ...(pointsTable[division] || {}),
      [place]: basePoints,
    },
  };
}

export function removePointsTableEntry(pointsTable, division, place) {
  const safeDivision = normalizeDivision(division);
  const safePlace = normalizePositiveInteger(place, 'Sijoituksen');
  const nextDivisionTable = { ...(pointsTable[safeDivision] || {}) };
  delete nextDivisionTable[safePlace];

  return {
    ...pointsTable,
    [safeDivision]: nextDivisionTable,
  };
}

export function clearPointsTableDivision(pointsTable, division) {
  const safeDivision = normalizeDivision(division);

  return {
    ...pointsTable,
    [safeDivision]: {},
  };
}

export function listPointsTableEntries(pointsTable, division = null) {
  const divisions = division ? [normalizeDivision(division)] : DIVISIONS;

  return divisions.flatMap((currentDivision) =>
    Object.entries(pointsTable[currentDivision] || {})
      .map(([place, basePoints]) => ({
        division: currentDivision,
        place: Number(place),
        basePoints: Number(basePoints),
      }))
      .sort((left, right) => left.place - right.place),
  );
}

function isHeaderRow(columns) {
  if (columns.length < 2) {
    return false;
  }

  const [firstColumn, secondColumn] = columns.map((value) => String(value ?? '').trim().toLowerCase());
  return (
    ['sijoitus', 'position'].includes(firstColumn) &&
    ['pisteet', 'points', 'peruspisteet', 'basepoints', 'base points'].includes(secondColumn)
  );
}

function parseDelimitedRow(line, separator = ';') {
  const columns = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === separator && !quoted) {
      columns.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  if (quoted) {
    throw new Error('CSV-rivillä on sulkematon lainausmerkki.');
  }

  columns.push(current.trim());
  return columns;
}

function splitCsvRecords(csvText) {
  const records = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      if (quoted && csvText[index + 1] === '"') {
        current += '""';
        index += 1;
      } else {
        quoted = !quoted;
        current += character;
      }
      continue;
    }

    if (character === '\n' || character === '\r') {
      if (quoted) {
        throw new Error('CSV-tiedoston tietueet eivät saa sisältää rivinvaihtoja lainausmerkkien sisällä.');
      }

      if (character === '\r' && csvText[index + 1] === '\n') {
        index += 1;
      }
      records.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  if (quoted) {
    throw new Error('CSV-rivillä on sulkematon lainausmerkki.');
  }

  records.push(current);
  return records;
}

export function parsePointsTableCsv(csvText) {
  const lines = splitCsvRecords(String(csvText ?? '').replace(/^\uFEFF/, ''));
  const entries = [];
  const seenPlaces = new Set();
  let skippedHeader = false;

  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    const columns = parseDelimitedRow(line);
    if (!skippedHeader && isHeaderRow(columns)) {
      skippedHeader = true;
      return;
    }

    if (columns.length !== 2) {
      throw new Error(`CSV-rivillä ${index + 1} pitää olla muodossa Sijoitus;Pisteet.`);
    }

    const [placeValue, pointsValue] = columns;
    if (!pointsValue) {
      throw new Error(`CSV-riviltä ${index + 1} puuttuu pistearvo.`);
    }

    const place = normalizePositiveInteger(placeValue, 'Sijoituksen');
    const basePoints = normalizeNonNegativeNumber(pointsValue, 'Pisteiden');

    if (seenPlaces.has(place)) {
      throw new Error(`Sijoitusnumeroiden tulee olla uniikkeja. Päällekkäinen sijoitus: ${place}`);
    }

    seenPlaces.add(place);
    entries.push({ place, basePoints });
  });

  if (!entries.length) {
    throw new Error('CSV-tiedostossa ei ole tuotavia pistetaulukon rivejä.');
  }

  entries.sort((left, right) => left.place - right.place);

  for (let index = 0; index < entries.length; index += 1) {
    const expectedPlace = index + 1;
    if (entries[index].place !== expectedPlace) {
      throw new Error(`Sijoitusnumeroiden tulee olla peräkkäisiä ilman aukkoja. Puuttuva sijoitus: ${expectedPlace}`);
    }
  }

  return entries;
}

export function importPointsTableDivision(pointsTable, division, entries) {
  const safeDivision = normalizeDivision(division);

  return {
    ...pointsTable,
    [safeDivision]: Object.fromEntries(
      entries.map((entry) => [
        normalizePositiveInteger(entry.place, 'Sijoituksen'),
        normalizeNonNegativeNumber(entry.basePoints, 'Pisteiden'),
      ]),
    ),
  };
}

export function getBasePoints(pointsTable, division, place) {
  const safeDivision = normalizeDivision(division);
  const safePlace = normalizePositiveInteger(place, 'Sijoituksen');
  const divisionTable = pointsTable[safeDivision] || {};
  const value = divisionTable[safePlace];

  return typeof value === 'number' ? value : null;
}

export function calculatePoints({ basePoints, multiplier }) {
  const safeBasePoints = normalizeNonNegativeNumber(basePoints, 'Peruspisteiden');
  const safeMultiplier = Number(multiplier);

  if (!Number.isFinite(safeMultiplier) || safeMultiplier <= 0) {
    throw new Error('Kertoimen pitää olla nollaa suurempi luku.');
  }

  return safeBasePoints * safeMultiplier;
}

const PLACEMENT_PATTERN = /^(?<place>[1-9]\d{0,2})(?:T(?<tieCount>[1-9]\d{0,1}))?$/;

export function parsePlacement(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const match = PLACEMENT_PATTERN.exec(normalized);
  if (!match) {
    throw new Error('Sijoituksen muoto on virheellinen. Käytä muotoa 1 tai 3T4.');
  }

  const place = Number(match.groups.place);
  const tieCount = match.groups.tieCount ? Number(match.groups.tieCount) : 1;
  if (tieCount <= 0 || tieCount > 99) {
    throw new Error('Tasatuloksen pelaajamäärä pitää olla välillä 1–99.');
  }
  if (match.groups.tieCount && tieCount < 2) {
    throw new Error('Tasatuloksen pelaajamäärän pitää olla vähintään 2.');
  }

  return {
    raw: normalized,
    place,
    tieCount,
    isTie: tieCount > 1,
    rangeStart: place,
    rangeEnd: place + tieCount - 1,
  };
}

function rangesOverlap(left, right) {
  return left.rangeStart <= right.rangeEnd && right.rangeStart <= left.rangeEnd;
}

function validateResultCardPlacements(results) {
  const parsedPlacements = [];

  results.forEach((result) => {
    const parsed = parsePlacement(result.placement);
    if (parsed) {
      parsedPlacements.push({
        playerId: result.playerId,
        parsed,
      });
    }
  });

  for (let index = 0; index < parsedPlacements.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < parsedPlacements.length; compareIndex += 1) {
      const current = parsedPlacements[index];
      const compare = parsedPlacements[compareIndex];
      if (!rangesOverlap(current.parsed, compare.parsed)) {
        continue;
      }

      const sameTieNotation =
        current.parsed.isTie &&
        compare.parsed.isTie &&
        current.parsed.place === compare.parsed.place &&
        current.parsed.tieCount === compare.parsed.tieCount;

      if (!sameTieNotation) {
        throw new Error('Sijoitukset menevät päällekkäin tuloskortilla. Käytä uniikkeja sijoituksia tai samaa tasatulosta.');
      }
    }
  }
}

export function calculatePlacementPoints({
  placement,
  division,
  pointsTable,
  multiplier,
}) {
  const safeDivision = normalizeDivision(division);
  const parsedPlacement = parsePlacement(placement);
  if (!parsedPlacement) {
    return null;
  }

  if (!parsedPlacement.isTie) {
    const basePoints = getBasePoints(pointsTable, safeDivision, parsedPlacement.place);
    if (basePoints === null) {
      throw new Error(`Pisteitä ei ole määritetty sarjalle ${safeDivision} sijoitukselle ${parsedPlacement.place}.`);
    }

    return calculatePoints({
      basePoints,
      multiplier,
    });
  }

  let sum = 0;
  for (let place = parsedPlacement.rangeStart; place <= parsedPlacement.rangeEnd; place += 1) {
    const basePoints = getBasePoints(pointsTable, safeDivision, place);
    if (basePoints === null) {
      throw new Error(`Pisteitä ei ole määritetty sarjalle ${safeDivision} sijoitukselle ${place}.`);
    }
    sum += basePoints;
  }

  const averageBasePoints = sum / parsedPlacement.tieCount;
  return calculatePoints({
    basePoints: averageBasePoints,
    multiplier,
  });
}

export function recalculateResultCard({
  card,
  results = card?.results || [],
  players = [],
  pointsTable,
  multipliers = [],
}) {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const resolvedMultiplier = resolveTournamentMultiplier({
    multiplier: card?.multiplier,
    tournament: card?.tournamentId
      ? {
          id: card.tournamentId,
          multiplierId: card.multiplierId,
        }
      : null,
    multipliers,
  });

  const normalizedResults = results.map((result) => {
    const parsedPlacement = parsePlacement(result.placement);
    return {
      ...result,
      placement: parsedPlacement ? parsedPlacement.raw : '',
    };
  });

  validateResultCardPlacements(normalizedResults);

  return normalizedResults.map((result) => {
    const player = playerById.get(result.playerId);
    const safeDivision = normalizeDivision(result.division || player?.division);
    const calculatedPoints = calculatePlacementPoints({
      placement: result.placement,
      division: safeDivision,
      pointsTable,
      multiplier: resolvedMultiplier,
    });

    return {
      ...result,
      division: safeDivision,
      calculatedPoints,
    };
  });
}

function resolveTournamentMultiplier({ multiplier, tournament = null, multipliers = [] }) {
  const directMultiplier = Number(multiplier);
  if (Number.isFinite(directMultiplier) && directMultiplier > 0) {
    return directMultiplier;
  }

  if (!tournament?.multiplierId) {
    throw new Error('Turnauksen kerrointa ei löytynyt. Valitse turnaukselle tila ennen tuloksen tallennusta.');
  }

  const referencedMultiplier = findMultiplier(multipliers, tournament.multiplierId);
  if (!referencedMultiplier) {
    throw new Error('Turnauksen kerroinviite ei ole enää käytettävissä. Päivitä turnauksen tila.');
  }

  const referencedValue = Number(referencedMultiplier?.multiplier);
  if (Number.isFinite(referencedValue) && referencedValue > 0) {
    return referencedValue;
  }

  throw new Error('Valitun tilan kerroin ei ole kelvollinen.');
}

export function createTournamentResult({
  tournamentId,
  playerId,
  place,
  division,
  pointsTable,
  multiplier,
  tournament = null,
  multipliers = [],
  existingResults = [],
}) {
  const safePlace = normalizePositiveInteger(place, 'Sijoituksen');
  const safeDivision = normalizeDivision(division);

  if (!tournamentId) {
    throw new Error('Turnaus pitää valita ennen tuloksen tallentamista.');
  }

  if (!playerId) {
    throw new Error('Pelaaja pitää valita ennen tuloksen tallentamista.');
  }

  const duplicateResult = existingResults.find(
    (result) => result.tournamentId === tournamentId && result.playerId === playerId,
  );

  if (duplicateResult) {
    throw new Error('Sama pelaaja voi esiintyä samassa turnauksessa vain kerran.');
  }

  const basePoints = getBasePoints(pointsTable, safeDivision, safePlace);
  if (basePoints === null) {
    throw new Error(`Pisteitä ei ole määritetty sarjalle ${safeDivision} sijoitukselle ${safePlace}.`);
  }

  const now = new Date().toISOString();
  const resolvedMultiplier = resolveTournamentMultiplier({ multiplier, tournament, multipliers });

  return {
    id: createId(),
    tournamentId,
    playerId,
    place: safePlace,
    basePointsSnapshot: basePoints,
    multiplierSnapshot: resolvedMultiplier,
    calculatedPoints: calculatePoints({ basePoints, multiplier: resolvedMultiplier }),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTournamentResult({
  results,
  resultId,
  tournamentId,
  playerId,
  place,
  division,
  pointsTable,
  multiplier,
  tournament = null,
  multipliers = [],
}) {
  const existingResult = results.find((result) => result.id === resultId);
  if (!existingResult) {
    throw new Error('Muokattavaa turnaustulosta ei löytynyt.');
  }

  const safePlace = normalizePositiveInteger(place, 'Sijoituksen');
  const safeDivision = normalizeDivision(division);

  const duplicateResult = results.find(
    (result) =>
      result.id !== resultId && result.tournamentId === tournamentId && result.playerId === playerId,
  );

  if (duplicateResult) {
    throw new Error('Sama pelaaja voi esiintyä samassa turnauksessa vain kerran.');
  }

  const basePoints = getBasePoints(pointsTable, safeDivision, safePlace);
  if (basePoints === null) {
    throw new Error(`Pisteitä ei ole määritetty sarjalle ${safeDivision} sijoitukselle ${safePlace}.`);
  }

  const resolvedMultiplier = resolveTournamentMultiplier({ multiplier, tournament, multipliers });

  return {
    ...existingResult,
    tournamentId,
    playerId,
    place: safePlace,
    basePointsSnapshot: basePoints,
    multiplierSnapshot: resolvedMultiplier,
    calculatedPoints: calculatePoints({ basePoints, multiplier: resolvedMultiplier }),
    updatedAt: new Date().toISOString(),
  };
}

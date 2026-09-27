export const DIVISIONS = ['MPO', 'FPO'];

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

export function parsePointsTableCsv(csvText) {
  const lines = String(csvText ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);
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

export function createTournamentResult({
  tournamentId,
  playerId,
  place,
  division,
  pointsTable,
  multiplier,
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

  return {
    id: createId(),
    tournamentId,
    playerId,
    place: safePlace,
    basePointsSnapshot: basePoints,
    multiplierSnapshot: Number(multiplier),
    calculatedPoints: calculatePoints({ basePoints, multiplier }),
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

  return {
    ...existingResult,
    tournamentId,
    playerId,
    place: safePlace,
    basePointsSnapshot: basePoints,
    multiplierSnapshot: Number(multiplier),
    calculatedPoints: calculatePoints({ basePoints, multiplier }),
    updatedAt: new Date().toISOString(),
  };
}

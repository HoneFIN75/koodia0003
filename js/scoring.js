const DIVISIONS = ['MPO', 'FPO'];

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

function normalizeNonNegativeNumber(value, label) {
  const parsed = Number(value);
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
    throw new Error('Multiplierin pitää olla nollaa suurempi luku.');
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

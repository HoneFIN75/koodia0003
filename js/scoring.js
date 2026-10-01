export const DIVISIONS = ['MPO', 'FPO'];
import { findMultiplier } from './multipliers.js';

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

// Sijoitus 0 tarkoittaa, ettei pelaaja osallistunut turnaukseen. Arvo on sallittu ja tallennetaan,
// mutta siitä ei koskaan lasketa pisteitä eikä sitä tulkita sijoitukseksi.
export const NON_PARTICIPATION_PLACEMENT = '0';

export function isNonParticipationPlacement(value) {
  return String(value ?? '').trim() === NON_PARTICIPATION_PLACEMENT;
}

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

function tryParsePlacement(value) {
  try {
    return parsePlacement(value);
  } catch {
    return null;
  }
}

// Tasatulosvalidointi saman turnauksen ja saman sarjan sisällä: sijoitusalueet eivät saa
// mennä päällekkäin (paitsi täsmälleen sama tasatulosmerkintä), eikä tasatuloksessa saa olla
// enemmän pelaajia kuin merkintä ilmoittaa. Muiden pelaajien sijoitukset voivat vielä puuttua.
export function validatePlacementAgainstOthers({ placement, others = [] }) {
  const parsed = parsePlacement(placement);
  if (!parsed) {
    return null;
  }

  let sameTieCount = 1;
  others.forEach((other) => {
    const otherParsed = tryParsePlacement(other.placement);
    if (!otherParsed || !rangesOverlap(parsed, otherParsed)) {
      return;
    }

    const sameTieNotation =
      parsed.isTie &&
      otherParsed.isTie &&
      parsed.place === otherParsed.place &&
      parsed.tieCount === otherParsed.tieCount;

    if (!sameTieNotation) {
      const otherName = other.name ? `pelaajan ${other.name} ` : '';
      throw new Error(
        `Sijoitus ${parsed.raw} menee päällekkäin ${otherName}sijoituksen ${otherParsed.raw} kanssa. Käytä uniikkeja sijoituksia tai samaa tasatulosta.`,
      );
    }

    sameTieCount += 1;
  });

  if (parsed.isTie && sameTieCount > parsed.tieCount) {
    throw new Error(`Tasatuloksessa ${parsed.raw} on liikaa pelaajia suhteessa ilmoitettuun pelaajamäärään.`);
  }

  return parsed;
}

export function calculatePlacementPoints({
  placement,
  division,
  pointsTable,
  multiplier,
}) {
  const safeDivision = normalizeDivision(division);
  if (isNonParticipationPlacement(placement)) {
    return null;
  }

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

function resolveMultiplierById(multiplierId, multipliers = []) {
  if (!multiplierId) {
    throw new Error('Turnauksen kerrointa ei löytynyt. Valitse turnaukselle tila ennen tuloksen tallennusta.');
  }

  const referencedMultiplier = findMultiplier(multipliers, multiplierId);
  if (!referencedMultiplier) {
    throw new Error('Turnauksen kerroinviite ei ole enää käytettävissä. Päivitä turnauksen tila.');
  }

  const referencedValue = Number(referencedMultiplier.multiplier);
  if (!Number.isFinite(referencedValue) || referencedValue <= 0) {
    throw new Error('Valitun tilan kerroin ei ole kelvollinen.');
  }

  return referencedValue;
}

export function resolveTournamentMultiplier(tournament, multipliers = []) {
  return resolveMultiplierById(String(tournament?.multiplierId || '').trim(), multipliers);
}

// Tulokset ovat ainoa pistelähde: pisteet lasketaan aina nykyisestä sijoituksesta,
// pelaajan sarjan pistetaulukosta ja turnauksen nykyisestä kertoimesta. Arvoja ei tallenneta.
export function calculateResultPoints({ placement, player, tournament, pointsTable, multipliers = [] }) {
  if (!player) {
    throw new Error('Pelaajaa ei löytynyt.');
  }
  if (!tournament) {
    throw new Error('Turnausta ei löytynyt.');
  }

  const division = normalizeDivision(player.division);
  const multiplier = resolveTournamentMultiplier(tournament, multipliers);
  return calculatePlacementPoints({ placement, division, pointsTable, multiplier });
}

export function tryCalculateResultPoints(input) {
  try {
    const points = calculateResultPoints(input);
    return typeof points === 'number' && Number.isFinite(points) ? points : null;
  } catch {
    return null;
  }
}

export function listResultEntries(resultCards = []) {
  return resultCards.flatMap((card) =>
    (card?.results || [])
      .filter((result) => String(result?.placement ?? '').trim() !== '')
      .map((result) => ({
        playerId: card.playerId,
        tournamentId: result.tournamentId,
        placement: result.placement,
      })),
  );
}

export function calculateAllResultPoints({
  resultCards = [],
  players = [],
  pointsTable,
  multipliers = [],
  tournaments = [],
}) {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const tournamentById = new Map(tournaments.map((tournament) => [tournament.id, tournament]));

  return listResultEntries(resultCards).flatMap((entry) => {
    const player = playerById.get(entry.playerId);
    const tournament = tournamentById.get(entry.tournamentId);
    const calculatedPoints = tryCalculateResultPoints({
      placement: entry.placement,
      player,
      tournament,
      pointsTable,
      multipliers,
    });

    if (calculatedPoints === null) {
      return [];
    }

    return [{
      ...entry,
      division: player.division,
      calculatedPoints,
    }];
  });
}

export const DIVISIONS = ['MPO', 'FPO'];

export class PlayerValidationError extends Error {
  constructor(fieldErrors) {
    super(Object.values(fieldErrors)[0] || 'Pelaajan tiedoissa on virheitä.');
    this.name = 'PlayerValidationError';
    this.fieldErrors = fieldErrors;
  }
}

function createId(prefix = 'player') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function addFieldError(fieldErrors, fieldName, message) {
  if (!fieldErrors[fieldName]) {
    fieldErrors[fieldName] = message;
  }
}

function normalizeOptionalPositiveInteger(value, label, fieldName, fieldErrors) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (!/^\d+$/.test(normalized)) {
    addFieldError(fieldErrors, fieldName, `${label} pitää olla positiivinen kokonaisluku.`);
    return '';
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    addFieldError(fieldErrors, fieldName, `${label} pitää olla positiivinen kokonaisluku.`);
    return '';
  }

  return parsed;
}

function normalizeOptionalUrl(value, label, fieldName, fieldErrors) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
    return parsed.toString();
  } catch {
    addFieldError(fieldErrors, fieldName, `${label} ei ole kelvollinen verkko-osoite.`);
    return '';
  }
}

export function validatePlayerInput(input, players, currentId = null) {
  const fieldErrors = {};
  const name = normalizeText(input.name);
  const division = normalizeText(input.division).toUpperCase();
  const pdgaNumber = normalizeOptionalPositiveInteger(input.pdgaNumber, 'PDGA-numero', 'pdgaNumber', fieldErrors);
  const pdgaRating = normalizeOptionalPositiveInteger(input.pdgaRating, 'PDGA-rating', 'pdgaRating', fieldErrors);
  const worldRank = normalizeOptionalPositiveInteger(
    input.worldRank,
    'Maailmanrankingsijoitus',
    'worldRank',
    fieldErrors,
  );
  const birthYear = normalizeOptionalPositiveInteger(input.birthYear, 'Syntymävuosi', 'birthYear', fieldErrors);

  if (!name) {
    addFieldError(fieldErrors, 'name', 'Pelaajan nimi on pakollinen.');
  }

  if (!DIVISIONS.includes(division)) {
    addFieldError(fieldErrors, 'division', 'Pelaajan sarjan pitää olla MPO tai FPO.');
  }

  if (birthYear !== '' && String(birthYear).length !== 4) {
    addFieldError(fieldErrors, 'birthYear', 'Syntymävuoden pitää olla nelinumeroinen vuosiluku.');
  } else if (birthYear !== '' && (birthYear < 1900 || birthYear > new Date().getFullYear() + 1)) {
    addFieldError(fieldErrors, 'birthYear', 'Syntymävuosi ei ole realistinen.');
  }

  const duplicatePdgaNumber = players.find(
    (player) => player.id !== currentId && player.pdgaNumber !== '' && player.pdgaNumber === pdgaNumber,
  );

  if (duplicatePdgaNumber) {
    addFieldError(fieldErrors, 'pdgaNumber', 'PDGA-numero on jo käytössä toisella pelaajalla.');
  }

  const pdgaProfileUrl = normalizeOptionalUrl(input.pdgaProfileUrl, 'PDGA-profiilin URL', 'pdgaProfileUrl', fieldErrors);

  if (Object.keys(fieldErrors).length > 0) {
    throw new PlayerValidationError(fieldErrors);
  }

  return {
    name,
    division,
    pdgaNumber,
    pdgaRating,
    worldRank,
    pdgaProfileUrl,
    country: normalizeText(input.country),
    birthYear,
    notes: normalizeText(input.notes),
  };
}

export function createPlayer(players, input) {
  const now = new Date().toISOString();
  const normalized = validatePlayerInput(input, players);

  return {
    ...normalized,
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePlayer(players, playerId, input) {
  const existingPlayer = players.find((player) => player.id === playerId);
  if (!existingPlayer) {
    throw new Error('Muokattavaa pelaajaa ei löytynyt.');
  }

  return {
    ...existingPlayer,
    ...validatePlayerInput(input, players, playerId),
    updatedAt: new Date().toISOString(),
  };
}

export function findPlayer(players, playerId) {
  return players.find((player) => player.id === playerId) || null;
}

export function removePlayer(players, playerId) {
  const existingPlayer = findPlayer(players, playerId);
  if (!existingPlayer) {
    throw new Error('Poistettavaa pelaajaa ei löytynyt.');
  }

  return players.filter((player) => player.id !== playerId);
}

export function sortPlayersByName(players) {
  return [...players].sort((left, right) => left.name.localeCompare(right.name, 'fi'));
}

export function filterPlayersByDivision(players, division) {
  if (!division || division === 'ALL') {
    return sortPlayersByName(players);
  }

  return sortPlayersByName(players.filter((player) => player.division === division));
}

export function searchPlayers(players, query) {
  const normalizedQuery = normalizeText(query).toLocaleLowerCase('fi');
  if (!normalizedQuery) {
    return sortPlayersByName(players);
  }

  return sortPlayersByName(
    players.filter((player) => {
      const nameMatch = player.name.toLocaleLowerCase('fi').includes(normalizedQuery);
      const pdgaMatch = String(player.pdgaNumber || '').includes(normalizedQuery);
      return nameMatch || pdgaMatch;
    }),
  );
}

export function getVisiblePlayers(players, { division = 'ALL', query = '' } = {}) {
  return searchPlayers(filterPlayersByDivision(players, division), query);
}

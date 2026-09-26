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

function splitName(nameValue) {
  const normalizedName = normalizeText(nameValue);
  if (!normalizedName) {
    return { firstName: '', lastName: '' };
  }

  const [firstName = '', ...restParts] = normalizedName.split(/\s+/);
  return {
    firstName,
    lastName: restParts.join(' '),
  };
}

function normalizeRequiredPositiveInteger(value, label, fieldName, fieldErrors) {
  const normalized = normalizeText(value);
  if (!normalized) {
    addFieldError(fieldErrors, fieldName, `${label} on pakollinen.`);
    return '';
  }

  return normalizeOptionalPositiveInteger(normalized, label, fieldName, fieldErrors);
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

function normalizePlayerName(input = {}) {
  const fallbackName = splitName(input.name);
  const firstName = normalizeText(Object.hasOwn(input, 'firstName') ? input.firstName : fallbackName.firstName);
  const lastName = normalizeText(Object.hasOwn(input, 'lastName') ? input.lastName : fallbackName.lastName);

  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
  };
}

export function validatePlayerInput(input, players, currentId = null) {
  const fieldErrors = {};
  const { firstName, lastName, name } = normalizePlayerName(input);
  const division = normalizeText(input.division).toUpperCase();
  const pdgaNumber = normalizeRequiredPositiveInteger(input.pdgaNumber, 'PDGA-numero', 'pdgaNumber', fieldErrors);
  const pdgaRating = normalizeOptionalPositiveInteger(input.pdgaRating, 'PDGA-rating', 'pdgaRating', fieldErrors);
  const worldRank = normalizeOptionalPositiveInteger(
    input.worldRank,
    'Maailmanrankingsijoitus',
    'worldRank',
    fieldErrors,
  );

  if (!firstName) {
    addFieldError(fieldErrors, 'firstName', 'Etunimi on pakollinen.');
  }

  if (!lastName) {
    addFieldError(fieldErrors, 'lastName', 'Sukunimi on pakollinen.');
  }

  if (!DIVISIONS.includes(division)) {
    addFieldError(fieldErrors, 'division', 'Pelaajan sarjan pitää olla MPO tai FPO.');
  }

  const duplicatePdgaNumber = players.find((player) => player.id !== currentId && player.pdgaNumber === pdgaNumber);

  if (duplicatePdgaNumber) {
    addFieldError(fieldErrors, 'pdgaNumber', 'PDGA-numero on jo käytössä toisella pelaajalla.');
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new PlayerValidationError(fieldErrors);
  }

  return {
    firstName,
    lastName,
    name,
    division,
    pdgaNumber,
    pdgaRating,
    worldRank,
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

export function canRequestPlayerDeletion(editingPlayerId, playerId) {
  return Boolean(playerId) && editingPlayerId === playerId;
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

export function sortPlayers(players, { field = 'name', direction = 'asc' } = {}) {
  const sortedPlayers = [...players].sort((left, right) => {
    if (field === 'pdgaNumber') {
      const leftPdga = Number(left.pdgaNumber) || 0;
      const rightPdga = Number(right.pdgaNumber) || 0;
      if (leftPdga !== rightPdga) {
        return leftPdga - rightPdga;
      }
      return String(left.id || '').localeCompare(String(right.id || ''), 'fi');
    }

    const nameCompare = String(left.name || '').localeCompare(String(right.name || ''), 'fi');
    if (nameCompare !== 0) {
      return nameCompare;
    }

    const leftPdga = Number(left.pdgaNumber) || 0;
    const rightPdga = Number(right.pdgaNumber) || 0;
    if (leftPdga !== rightPdga) {
      return leftPdga - rightPdga;
    }

    return String(left.id || '').localeCompare(String(right.id || ''), 'fi');
  });

  if (direction === 'desc') {
    sortedPlayers.reverse();
  }

  return sortedPlayers;
}

export function getVisiblePlayers(players, { division = 'ALL', query = '', sortField = 'name', sortDirection = 'asc' } = {}) {
  return sortPlayers(searchPlayers(filterPlayersByDivision(players, division), query), {
    field: sortField,
    direction: sortDirection,
  });
}

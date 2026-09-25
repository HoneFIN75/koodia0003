export const DIVISIONS = ['MPO', 'FPO'];

function createId(prefix = 'player') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeOptionalInteger(value, label) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} pitää olla nolla tai positiivinen kokonaisluku.`);
  }

  return parsed;
}

function normalizeOptionalUrl(value, label) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  try {
    return new URL(normalized).toString();
  } catch {
    throw new Error(`${label} ei ole kelvollinen verkko-osoite.`);
  }
}

export function validatePlayerInput(input, players, currentId = null) {
  const name = normalizeText(input.name);
  const division = normalizeText(input.division).toUpperCase();
  const pdgaNumber = normalizeOptionalInteger(input.pdgaNumber, 'PDGA-numero');
  const pdgaRating = normalizeOptionalInteger(input.pdgaRating, 'PDGA-rating');
  const worldRank = normalizeOptionalInteger(input.worldRank, 'Maailmanrankingsijoitus');
  const birthYear = normalizeOptionalInteger(input.birthYear, 'Syntymävuosi');

  if (!name) {
    throw new Error('Pelaajan nimi on pakollinen.');
  }

  if (!DIVISIONS.includes(division)) {
    throw new Error('Pelaajan sarjan pitää olla MPO tai FPO.');
  }

  if (birthYear !== '' && (birthYear < 1900 || birthYear > new Date().getFullYear() + 1)) {
    throw new Error('Syntymävuosi ei ole realistinen.');
  }

  const duplicatePdgaNumber = players.find(
    (player) => player.id !== currentId && player.pdgaNumber !== '' && player.pdgaNumber === pdgaNumber,
  );

  if (duplicatePdgaNumber) {
    throw new Error('PDGA-numero on jo käytössä toisella pelaajalla.');
  }

  return {
    name,
    division,
    pdgaNumber,
    pdgaRating,
    worldRank,
    pdgaProfileUrl: normalizeOptionalUrl(input.pdgaProfileUrl, 'PDGA-profiilin URL'),
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

export function sortPlayersByName(players) {
  return [...players].sort((left, right) => left.name.localeCompare(right.name, 'fi'));
}

export function filterPlayersByDivision(players, division) {
  if (!division || division === 'ALL') {
    return sortPlayersByName(players);
  }

  return sortPlayersByName(players.filter((player) => player.division === division));
}

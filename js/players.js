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

function normalizeCsvInteger(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
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
  let currentLine = 1;
  let recordStartLine = 1;

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
        if (character === '\r' && csvText[index + 1] === '\n') {
          current += '\r\n';
          index += 1;
        } else {
          current += character;
        }
        currentLine += 1;
        continue;
      }

      if (character === '\r' && csvText[index + 1] === '\n') {
        index += 1;
      }
      records.push({ value: current, lineNumber: recordStartLine });
      current = '';
      currentLine += 1;
      recordStartLine = currentLine;
      continue;
    }

    current += character;
  }

  if (quoted) {
    throw new Error('CSV-rivillä on sulkematon lainausmerkki.');
  }

  records.push({ value: current, lineNumber: recordStartLine });
  return records;
}

function normalizeHeaderToken(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fi')
    .replace(/[\s_-]+/g, '');
}

function isPlayersCsvHeader(columns) {
  if (columns.length < 3) {
    return false;
  }

  const firstColumn = normalizeHeaderToken(columns[0]);
  const secondColumn = normalizeHeaderToken(columns[1]);
  const thirdColumn = normalizeHeaderToken(columns[2]);

  return (
    ['etunimi', 'firstname'].includes(firstColumn) &&
    ['sukunimi', 'lastname'].includes(secondColumn) &&
    ['pdgaid', 'pdga'].includes(thirdColumn)
  );
}

function buildImportedPlayer({ firstName, lastName, pdgaNumber, pdgaRating, worldRank, division }) {
  const now = new Date().toISOString();

  return {
    id: createId(),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    division,
    pdgaNumber,
    pdgaRating,
    worldRank,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

function parsePlayerImportRow(columns, rowNumber, safeDivision, existingPdgaNumbers) {
  if (columns.length !== 5) {
    return { failure: { rowNumber, pdgaId: '', reason: 'CSV-rivin sarakemäärä on virheellinen' } };
  }

  const firstName = normalizeText(columns[0]);
  const lastName = normalizeText(columns[1]);
  const pdgaNumber = normalizeCsvInteger(columns[2]);
  const pdgaNumberText = normalizeText(columns[2]);
  const pdgaRatingText = normalizeText(columns[3]);
  const worldRankText = normalizeText(columns[4]);

  if (!pdgaNumberText) {
    return { failure: { rowNumber, pdgaId: '', reason: 'PDGA ID puuttuu' } };
  }

  if (pdgaNumber === null) {
    return { failure: { rowNumber, pdgaId: pdgaNumberText, reason: 'Virheellinen PDGA ID' } };
  }

  const pdgaRating = pdgaRatingText ? normalizeCsvInteger(pdgaRatingText) : '';
  if (pdgaRatingText && pdgaRating === null) {
    return { failure: { rowNumber, pdgaId: String(pdgaNumber), reason: 'Virheellinen PDGA-rating' } };
  }

  const worldRank = worldRankText ? normalizeCsvInteger(worldRankText) : '';
  if (worldRankText && worldRank === null) {
    return { failure: { rowNumber, pdgaId: String(pdgaNumber), reason: 'Virheellinen maailmanranking' } };
  }

  if (existingPdgaNumbers.has(pdgaNumber)) {
    return { failure: { rowNumber, pdgaId: String(pdgaNumber), reason: 'Pelaaja löytyy jo järjestelmästä' } };
  }

  return {
    player: buildImportedPlayer({
      firstName,
      lastName,
      pdgaNumber,
      pdgaRating,
      worldRank,
      division: safeDivision,
    }),
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

export function importPlayersFromCsv(players, csvText, division) {
  const safeDivision = normalizeText(division).toUpperCase();
  if (!DIVISIONS.includes(safeDivision)) {
    throw new Error('Valitse divisioona ennen CSV-tuontia.');
  }

  const records = splitCsvRecords(String(csvText ?? '').replace(/^\uFEFF/, ''));
  const existingPdgaNumbers = new Set(
    players
      .map((player) => normalizeCsvInteger(player.pdgaNumber))
      .filter((pdgaNumber) => pdgaNumber !== null),
  );
  const importedPlayers = [];
  const failures = [];
  let totalRows = 0;
  let skippedHeader = false;

  records.forEach((record) => {
    const line = record.value;
    if (!line.trim()) {
      return;
    }

    const columns = parseDelimitedRow(line);
    if (!skippedHeader && isPlayersCsvHeader(columns)) {
      skippedHeader = true;
      return;
    }

    totalRows += 1;
    const rowNumber = record.lineNumber;
    const parsedRow = parsePlayerImportRow(columns, rowNumber, safeDivision, existingPdgaNumbers);
    if (parsedRow.failure) {
      failures.push(parsedRow.failure);
      return;
    }

    importedPlayers.push(parsedRow.player);
    existingPdgaNumbers.add(parsedRow.player.pdgaNumber);
  });

  if (!totalRows) {
    throw new Error('CSV-tiedostossa ei ole tuotavia pelaajarivejä.');
  }

  return {
    importedPlayers,
    summary: {
      totalRows,
      importedCount: importedPlayers.length,
      failedCount: failures.length,
      failures,
    },
  };
}

export function parseRatingRankingCsv(csvText) {
  const records = splitCsvRecords(String(csvText ?? '').replace(/^\uFEFF/, '')).filter((record) => record.value.trim());
  const header = records.shift();
  if (!header || parseDelimitedRow(header.value).map(normalizeHeaderToken).join(';') !== 'pdgaid;rating;ranking') {
    throw new Error('CSV-tiedoston otsikko pitää olla PDGA ID;Rating;Ranking.');
  }
  if (!records.length) {
    throw new Error('CSV-tiedostossa ei ole päivitettäviä pelaajarivejä.');
  }

  const entries = records.map((record) => {
    const columns = parseDelimitedRow(record.value);
    return { rowNumber: record.lineNumber, columns, pdgaId: normalizeText(columns[0]), pdgaNumber: normalizeCsvInteger(columns[0]) };
  });
  const counts = new Map();
  entries.forEach(({ pdgaNumber }) => {
    if (pdgaNumber !== null) counts.set(pdgaNumber, (counts.get(pdgaNumber) || 0) + 1);
  });

  const rows = [];
  const errors = [];
  entries.forEach(({ rowNumber, columns, pdgaId, pdgaNumber }) => {
    let reason = '';
    if (columns.length !== 3) reason = 'CSV-rivin sarakemäärä on virheellinen';
    else if (!pdgaId) reason = 'PDGA ID puuttuu';
    else if (pdgaNumber === null) reason = 'Virheellinen PDGA ID';
    else if (counts.get(pdgaNumber) > 1) reason = 'PDGA ID esiintyy CSV-tiedostossa useammin kuin kerran';
    const pdgaRating = normalizeCsvInteger(columns[1]);
    const worldRank = normalizeCsvInteger(columns[2]);
    if (!reason && pdgaRating === null) reason = 'Virheellinen Rating';
    if (!reason && worldRank === null) reason = 'Virheellinen Ranking';
    if (reason) {
      errors.push({ rowNumber, pdgaId, reason });
    } else {
      rows.push({ rowNumber, pdgaNumber, pdgaRating, worldRank });
    }
  });
  return { rows, errors };
}

export function importRatingRankingFromCsv(players, csvText) {
  const { rows, errors } = parseRatingRankingCsv(csvText);
  const byPdgaNumber = new Map(players.map((player) => [normalizeCsvInteger(player.pdgaNumber), player]));
  const updates = new Map();
  const observations = [];
  rows.forEach(({ rowNumber, pdgaNumber, pdgaRating, worldRank }) => {
    const player = byPdgaNumber.get(pdgaNumber);
    if (!player) {
      observations.push({ rowNumber, pdgaId: String(pdgaNumber), reason: 'Pelaajaa ei löydy järjestelmästä' });
    } else {
      updates.set(player.id, { pdgaRating, worldRank });
    }
  });
  return {
    updatedPlayers: players.map((player) => updates.has(player.id) ? { ...player, ...updates.get(player.id) } : player),
    summary: { updatedCount: updates.size, errors, observations },
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

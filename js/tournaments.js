export const DEFAULT_TOURNAMENT_DISPLAY_ORDER = 999;

const ALLOWED_DIVISIONS = ['', 'MPO', 'FPO'];
export const TOURNAMENT_CONTINENTS = [
  { value: 'asia', label: 'Aasia' },
  { value: 'africa', label: 'Afrikka' },
  { value: 'europe', label: 'Eurooppa' },
  { value: 'north-america', label: 'Pohjois-Amerikka' },
  { value: 'south-america', label: 'Etelä-Amerikka' },
  { value: 'australia', label: 'Australia' },
  { value: 'antarctica', label: 'Etelämanner (Antarktis)' },
];

export class TournamentValidationError extends Error {
  constructor(fieldErrors) {
    super(Object.values(fieldErrors)[0] || 'Turnauksen tiedoissa on virheitä.');
    this.name = 'TournamentValidationError';
    this.fieldErrors = fieldErrors;
  }
}

function createId(prefix = 'tournament') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeTournamentContinent(value) {
  const normalized = normalizeText(value).toLocaleLowerCase('fi-FI');
  if (!normalized) {
    return '';
  }

  const continent = TOURNAMENT_CONTINENTS.find(
    (option) => option.value === normalized || option.label.toLocaleLowerCase('fi-FI') === normalized,
  );
  return continent?.value ?? null;
}

function normalizeCsvInteger(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (normalized === '000000') {
    return '000000';
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '');
}

function isTournamentsCsvHeader(columns) {
  if (columns.length < 3) {
    return false;
  }

  const firstColumn = normalizeHeaderToken(columns[0]);
  const secondColumn = normalizeHeaderToken(columns[1]);
  const thirdColumn = normalizeHeaderToken(columns[2]);

  return (
    ['jarjestysnumero', 'orderingnumber', 'order', 'displayorder'].includes(firstColumn) &&
    ['pdgaeventid', 'pdgaid', 'pdgaevent'].includes(secondColumn) &&
    ['turnauksennimi', 'tournamentname', 'nimi'].includes(thirdColumn)
  );
}

function addFieldError(fieldErrors, fieldName, message) {
  if (!fieldErrors[fieldName]) {
    fieldErrors[fieldName] = message;
  }
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

function normalizeOptionalPositiveInteger(value, label, fieldName, fieldErrors, allowUnassigned = false) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (allowUnassigned && normalized === '000000') {
    return '000000';
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

function normalizeDisplayOrder(value, fieldErrors) {
  const normalized = normalizeText(value);
  if (!normalized) {
    addFieldError(fieldErrors, 'displayOrder', 'Järjestysnumero on pakollinen.');
    return DEFAULT_TOURNAMENT_DISPLAY_ORDER;
  }

  if (!/^\d+$/.test(normalized)) {
    addFieldError(fieldErrors, 'displayOrder', 'Järjestysnumeron pitää olla positiivinen kokonaisluku.');
    return DEFAULT_TOURNAMENT_DISPLAY_ORDER;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    addFieldError(fieldErrors, 'displayOrder', 'Järjestysnumeron pitää olla positiivinen kokonaisluku.');
    return DEFAULT_TOURNAMENT_DISPLAY_ORDER;
  }

  return parsed;
}

function normalizeMultiplierId(value, multipliers, fieldErrors) {
  const multiplierId = normalizeText(value);
  if (!multiplierId) {
    addFieldError(fieldErrors, 'multiplierId', 'Tila on pakollinen.');
    return '';
  }

  const exists = multipliers.some((multiplier) => multiplier.id === multiplierId);
  if (!exists) {
    addFieldError(fieldErrors, 'multiplierId', 'Valittu tila ei ole enää käytettävissä.');
  }

  return multiplierId;
}

function ensureDisplayOrderIsUnique(tournaments, displayOrder, currentTournamentId, fieldErrors) {
  const duplicate = tournaments.find(
    (tournament) => tournament.id !== currentTournamentId && Number(tournament.displayOrder) === Number(displayOrder),
  );

  if (duplicate) {
    addFieldError(fieldErrors, 'displayOrder', `Järjestysnumero ${displayOrder} on jo käytössä.`);
  }
}

export function validateTournamentInput(tournaments, multipliers, input, currentTournamentId = null) {
  const fieldErrors = {};
  const name = normalizeText(input.name);
  const startDate = normalizeText(input.startDate);
  const endDate = normalizeText(input.endDate);
  const division = normalizeText(input.division).toUpperCase();
  const continent = normalizeTournamentContinent(input.continent);
  const displayOrder = normalizeDisplayOrder(input.displayOrder, fieldErrors);
  const multiplierId = normalizeMultiplierId(input.multiplierId, multipliers, fieldErrors);

  if (!name) {
    addFieldError(fieldErrors, 'name', 'Turnauksen nimi on pakollinen.');
  }

  if (!startDate) {
    addFieldError(fieldErrors, 'startDate', 'Päivämäärä on pakollinen.');
  }

  if (startDate && endDate && endDate < startDate) {
    addFieldError(fieldErrors, 'endDate', 'Päättymispäivä ei voi olla ennen alkamispäivää.');
  }

  if (!ALLOWED_DIVISIONS.includes(division)) {
    addFieldError(fieldErrors, 'division', 'Turnauksen sarjarajaus voi olla vain MPO, FPO tai tyhjä.');
  }

  if (continent === null) {
    addFieldError(fieldErrors, 'continent', 'Valitse luettelossa oleva maanosa.');
  }

  ensureDisplayOrderIsUnique(tournaments, displayOrder, currentTournamentId, fieldErrors);

  const externalUrl = normalizeOptionalUrl(input.externalUrl, 'Linkki kilpailusivulle', 'externalUrl', fieldErrors);
  const pdgaEventId = normalizeOptionalPositiveInteger(input.pdgaEventId, 'PDGA-kilpailutunnus', 'pdgaEventId', fieldErrors, true);

  if (Object.keys(fieldErrors).length > 0) {
    throw new TournamentValidationError(fieldErrors);
  }

  return {
    name,
    pdgaEventId,
    startDate,
    endDate,
    displayOrder,
    location: normalizeText(input.location),
    venue: normalizeText(input.venue),
    multiplierId,
    division,
    continent: continent ?? '',
    externalUrl,
    notes: normalizeText(input.notes),
  };
}

export function createTournament(tournaments, multipliers, input) {
  const now = new Date().toISOString();

  return {
    ...validateTournamentInput(tournaments, multipliers, input),
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
}

function buildImportedTournament({ name, pdgaEventId, displayOrder, continent }) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name,
    pdgaEventId,
    startDate: '',
    endDate: '',
    displayOrder,
    location: '',
    venue: '',
    multiplierId: '',
    division: '',
    continent,
    externalUrl: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

function parseTournamentImportRow(columns, rowNumber, existingPdgaEventIds, existingDisplayOrders) {
  if (columns.length < 3) {
    return { failure: { rowNumber, reason: 'CSV-rivin sarakemäärä on virheellinen' } };
  }

  const displayOrderText = normalizeText(columns[0]);
  const pdgaEventIdText = normalizeText(columns[1]);
  const name = normalizeText(columns[2]);
  const continent = normalizeTournamentContinent(columns[3]);
  const parsedDisplayOrder = normalizeCsvInteger(displayOrderText);
  const parsedPdgaEventId = normalizeCsvInteger(pdgaEventIdText);

  if (!displayOrderText) {
    return { failure: { rowNumber, reason: 'Järjestysnumero puuttuu' } };
  }

  if (parsedDisplayOrder === null) {
    return { failure: { rowNumber, reason: 'Virheellinen järjestysnumero' } };
  }

  if (!pdgaEventIdText) {
    return { failure: { rowNumber, reason: 'PDGA Event ID puuttuu' } };
  }

  if (parsedPdgaEventId === null) {
    return { failure: { rowNumber, reason: 'Virheellinen PDGA Event ID' } };
  }

  if (!name) {
    return { failure: { rowNumber, reason: 'Turnauksen nimi puuttuu' } };
  }

  if (continent === null) {
    return { failure: { rowNumber, reason: 'Virheellinen maanosa' } };
  }

  if (existingDisplayOrders.has(parsedDisplayOrder)) {
    return {
      failure: {
        rowNumber,
        reason: `Järjestysnumero on jo käytössä (${parsedDisplayOrder})`,
      },
    };
  }

  if (parsedPdgaEventId !== '000000' && existingPdgaEventIds.has(parsedPdgaEventId)) {
    return {
      duplicate: {
        rowNumber,
        reason: `PDGA Event ID on jo olemassa (${parsedPdgaEventId})`,
      },
    };
  }

  return {
    tournament: buildImportedTournament({
      displayOrder: parsedDisplayOrder,
      pdgaEventId: parsedPdgaEventId,
      name,
      continent,
    }),
  };
}

export function importTournamentsFromCsv(tournaments, csvText) {
  const records = splitCsvRecords(String(csvText ?? '').replace(/^\uFEFF/, ''));
  const existingPdgaEventIds = new Set(
    tournaments
      .map((tournament) => normalizeCsvInteger(tournament.pdgaEventId))
      .filter((pdgaEventId) => pdgaEventId !== null && pdgaEventId !== '000000'),
  );
  const existingDisplayOrders = new Set(
    tournaments
      .map((tournament) => normalizeCsvInteger(tournament.displayOrder))
      .filter((displayOrder) => displayOrder !== null),
  );
  const importedTournaments = [];
  const failures = [];
  let totalRows = 0;
  let duplicateCount = 0;
  let skippedHeader = false;

  records.forEach((record) => {
    const line = record.value;
    if (!line.trim()) {
      return;
    }

    const columns = parseDelimitedRow(line);
    if (!skippedHeader && isTournamentsCsvHeader(columns)) {
      skippedHeader = true;
      return;
    }

    totalRows += 1;
    const rowNumber = record.lineNumber;
    const parsedRow = parseTournamentImportRow(columns, rowNumber, existingPdgaEventIds, existingDisplayOrders);
    if (parsedRow.failure) {
      failures.push(parsedRow.failure);
      return;
    }

    if (parsedRow.duplicate) {
      duplicateCount += 1;
      failures.push(parsedRow.duplicate);
      return;
    }

    importedTournaments.push(parsedRow.tournament);
    if (parsedRow.tournament.pdgaEventId !== '000000') {
      existingPdgaEventIds.add(parsedRow.tournament.pdgaEventId);
    }
    existingDisplayOrders.add(parsedRow.tournament.displayOrder);
  });

  if (!totalRows) {
    return {
      importedTournaments,
      summary: {
        totalRows: 0,
        importedCount: 0,
        duplicateCount: 0,
        validationErrorCount: 1,
        failures: [{ rowNumber: 1, reason: 'CSV-tiedostossa ei ole tuotavia turnausrivejä.' }],
      },
    };
  }

  return {
    importedTournaments,
    summary: {
      totalRows,
      importedCount: importedTournaments.length,
      duplicateCount,
      validationErrorCount: failures.length - duplicateCount,
      failures,
    },
  };
}

export function updateTournament(tournaments, multipliers, tournamentId, input) {
  const existingTournament = tournaments.find((tournament) => tournament.id === tournamentId);
  if (!existingTournament) {
    throw new Error('Muokattavaa turnausta ei löytynyt.');
  }

  return {
    ...existingTournament,
    ...validateTournamentInput(tournaments, multipliers, input, tournamentId),
    updatedAt: new Date().toISOString(),
  };
}

export function sortTournaments(tournaments) {
  return [...tournaments].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }

    const leftDate = left.startDate || '';
    const rightDate = right.startDate || '';
    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    const leftCreatedAt = left.createdAt || '';
    const rightCreatedAt = right.createdAt || '';
    if (leftCreatedAt !== rightCreatedAt) {
      if (!leftCreatedAt) {
        return 1;
      }
      if (!rightCreatedAt) {
        return -1;
      }
      return leftCreatedAt.localeCompare(rightCreatedAt);
    }

    return String(left.id || '').localeCompare(String(right.id || ''), 'fi');
  });
}

function normalizeFilterValue(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fi-FI');
}

function compareTournamentValues(leftValue, rightValue, direction) {
  const left = String(leftValue ?? '');
  const right = String(rightValue ?? '');

  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  const comparison = left.localeCompare(right, 'fi', { numeric: true, sensitivity: 'base' });
  return direction === 'desc' ? comparison * -1 : comparison;
}

export function filterAndSortTournaments(
  tournaments,
  { search = '', status = 'ALL', sortField = 'displayOrder', sortDirection = 'asc' } = {},
) {
  const baseOrder = sortTournaments(tournaments);
  const baseOrderById = new Map(baseOrder.map((tournament, index) => [tournament.id, index]));
  const normalizedSearch = normalizeFilterValue(search);
  const normalizedStatus = normalizeFilterValue(status);
  const normalizedSortField = ['displayOrder', 'name', 'multiplierId', 'startDate', 'endDate', 'location'].includes(sortField)
    ? sortField
    : 'displayOrder';
  const normalizedSortDirection = sortDirection === 'desc' ? 'desc' : 'asc';

  return baseOrder
    .filter((tournament) => {
      const matchesStatus = normalizedStatus === 'all' || normalizeFilterValue(tournament.multiplierId) === normalizedStatus;
      const matchesSearch =
        !normalizedSearch ||
        [tournament.name, tournament.location, tournament.venue].some((value) =>
          normalizeFilterValue(value).includes(normalizedSearch),
        );

      return matchesStatus && matchesSearch;
    })
    .sort((left, right) => {
      const comparison = compareTournamentValues(left[normalizedSortField], right[normalizedSortField], normalizedSortDirection);
      if (comparison !== 0) {
        return comparison;
      }

      return (baseOrderById.get(left.id) || 0) - (baseOrderById.get(right.id) || 0);
    });
}

export function findTournament(tournaments, tournamentId) {
  return tournaments.find((tournament) => tournament.id === tournamentId) || null;
}

function formatTournamentDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
}

// Turnauksen päivämäärät muodossa pp.kk.vvvv. Yksipäiväisestä turnauksesta
// (sama tai puuttuva päättymispäivä) näytetään vain yksi päivämäärä.
export function formatTournamentDateRange(startDate, endDate) {
  const start = formatTournamentDate(startDate);
  const end = formatTournamentDate(endDate);
  if (!start) {
    return end;
  }

  return end && end !== start ? `${start} - ${end}` : start;
}

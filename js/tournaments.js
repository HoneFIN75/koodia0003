export const MULTIPLIER_OPTIONS = [
  { key: 'fpt-status', label: 'Finnish Pro Tour Status', value: 0.5 },
  { key: 'fpt', label: 'Finnish Pro Tour', value: 1 },
  { key: 'dgpt', label: 'DGPT', value: 3 },
  { key: 'finnish-championship', label: 'Finnish Championship', value: 4 },
  { key: 'dgpt-plus', label: 'DGPT+', value: 4 },
  { key: 'dgpt-playoffs', label: 'DGPT Playoffs', value: 5 },
  { key: 'european-championship', label: 'European Championship', value: 5 },
  { key: 'pdga-major', label: 'PDGA Major', value: 6 },
];

export const DEFAULT_TOURNAMENT_DISPLAY_ORDER = 999;

const ALLOWED_DIVISIONS = ['', 'MPO', 'FPO'];
const ALLOWED_MULTIPLIERS = new Map(MULTIPLIER_OPTIONS.map((option) => [option.key, option.value]));

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

function normalizeCsvInteger(value) {
  const normalized = normalizeText(value);
  if (!normalized || !/^\d+$/.test(normalized)) {
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

function isTournamentsCsvHeader(columns) {
  if (columns.length < 2) {
    return false;
  }

  const firstColumn = normalizeHeaderToken(columns[0]);
  const secondColumn = normalizeHeaderToken(columns[1]);

  return ['pdgaeventid', 'pdgaid', 'pdgaevent'].includes(firstColumn) && ['turnauksennimi', 'tournamentname', 'nimi'].includes(secondColumn);
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

function normalizeMultiplier(multiplierKey) {
  const normalizedKey = normalizeText(multiplierKey);
  if (!normalizedKey) {
    throw new Error('Kerroin on pakollinen ja se pitää valita määritetyistä vaihtoehdoista.');
  }

  if (!ALLOWED_MULTIPLIERS.has(normalizedKey)) {
    throw new Error('Kerroin pitää valita määritetyistä vaihtoehdoista.');
  }

  return {
    multiplierKey: normalizedKey,
    multiplier: ALLOWED_MULTIPLIERS.get(normalizedKey),
  };
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

export function validateTournamentInput(input) {
  const fieldErrors = {};
  const name = normalizeText(input.name);
  const startDate = normalizeText(input.startDate);
  const endDate = normalizeText(input.endDate);
  const division = normalizeText(input.division).toUpperCase();
  const displayOrder = normalizeDisplayOrder(input.displayOrder, fieldErrors);

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

  let multiplierData = { multiplierKey: '', multiplier: 0 };
  try {
    multiplierData = normalizeMultiplier(input.multiplierKey);
  } catch (error) {
    addFieldError(
      fieldErrors,
      'multiplierKey',
      error instanceof Error ? error.message : 'Kerroin pitää valita määritetyistä vaihtoehdoista.',
    );
  }

  const externalUrl = normalizeOptionalUrl(input.externalUrl, 'Linkki kilpailusivulle', 'externalUrl', fieldErrors);
  const pdgaEventId = normalizeOptionalPositiveInteger(input.pdgaEventId, 'PDGA-kilpailutunnus', 'pdgaEventId', fieldErrors);

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
    status: normalizeText(input.status),
    ...multiplierData,
    division,
    externalUrl,
    notes: normalizeText(input.notes),
  };
}

export function createTournament(input) {
  const now = new Date().toISOString();

  return {
    ...validateTournamentInput(input),
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
}

function buildImportedTournament({ name, pdgaEventId }) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name,
    pdgaEventId,
    startDate: '',
    endDate: '',
    displayOrder: DEFAULT_TOURNAMENT_DISPLAY_ORDER,
    location: '',
    venue: '',
    status: '',
    multiplierKey: '',
    division: '',
    externalUrl: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

function parseTournamentImportRow(columns, rowNumber, existingPdgaEventIds) {
  if (columns.length < 2) {
    return { failure: { rowNumber, reason: 'CSV-rivin sarakemäärä on virheellinen' } };
  }

  const pdgaEventIdText = normalizeText(columns[0]);
  const name = normalizeText(columns[1]);
  const parsedPdgaEventId = normalizeCsvInteger(pdgaEventIdText);

  if (!pdgaEventIdText) {
    return { failure: { rowNumber, reason: 'PDGA Event ID puuttuu' } };
  }

  if (parsedPdgaEventId === null) {
    return { failure: { rowNumber, reason: 'Virheellinen PDGA Event ID' } };
  }

  if (!name) {
    return { failure: { rowNumber, reason: 'Turnauksen nimi puuttuu' } };
  }

  if (existingPdgaEventIds.has(parsedPdgaEventId)) {
    return {
      duplicate: {
        rowNumber,
        reason: `PDGA Event ID on jo järjestelmässä (${parsedPdgaEventId})`,
      },
    };
  }

  return {
    tournament: buildImportedTournament({
      pdgaEventId: parsedPdgaEventId,
      name,
    }),
  };
}

export function importTournamentsFromCsv(tournaments, csvText) {
  const records = splitCsvRecords(String(csvText ?? '').replace(/^\uFEFF/, ''));
  const existingPdgaEventIds = new Set(
    tournaments
      .map((tournament) => normalizeCsvInteger(tournament.pdgaEventId))
      .filter((pdgaEventId) => pdgaEventId !== null),
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
    const parsedRow = parseTournamentImportRow(columns, rowNumber, existingPdgaEventIds);
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
    existingPdgaEventIds.add(parsedRow.tournament.pdgaEventId);
  });

  if (!totalRows) {
    throw new Error('CSV-tiedostossa ei ole tuotavia turnausrivejä.');
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

export function updateTournament(tournaments, tournamentId, input) {
  const existingTournament = tournaments.find((tournament) => tournament.id === tournamentId);
  if (!existingTournament) {
    throw new Error('Muokattavaa turnausta ei löytynyt.');
  }

  return {
    ...existingTournament,
    ...validateTournamentInput(input),
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
  { search = '', status = 'ALL', sortField = 'startDate', sortDirection = 'asc' } = {},
) {
  const baseOrder = sortTournaments(tournaments);
  const baseOrderById = new Map(baseOrder.map((tournament, index) => [tournament.id, index]));
  const normalizedSearch = normalizeFilterValue(search);
  const normalizedStatus = normalizeFilterValue(status);
  const normalizedSortField = ['name', 'status', 'startDate', 'endDate', 'location'].includes(sortField)
    ? sortField
    : 'startDate';
  const normalizedSortDirection = sortDirection === 'desc' ? 'desc' : 'asc';

  return baseOrder
    .filter((tournament) => {
      const matchesStatus =
        normalizedStatus === 'all' || normalizeFilterValue(tournament.status) === normalizedStatus;
      const matchesSearch =
        !normalizedSearch ||
        [tournament.name, tournament.status, tournament.location, tournament.venue].some((value) =>
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

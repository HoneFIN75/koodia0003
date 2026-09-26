import { isValidPdgaId, normalizePdgaId } from './pdga.js';

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

function addFieldError(fieldErrors, fieldName, message) {
  if (!fieldErrors[fieldName]) {
    fieldErrors[fieldName] = message;
  }
}

function normalizeMultiplier(multiplierKey) {
  const normalizedKey = normalizeText(multiplierKey);
  if (!normalizedKey) {
    throw new Error('Multiplier on pakollinen ja se pitää valita määritetyistä vaihtoehdoista.');
  }

  if (!ALLOWED_MULTIPLIERS.has(normalizedKey)) {
    throw new Error('Multiplier pitää valita määritetyistä vaihtoehdoista.');
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
      error instanceof Error ? error.message : 'Multiplier pitää valita määritetyistä vaihtoehdoista.',
    );
  }

  const pdgaEventId = normalizePdgaId(input.pdgaEventId);
  if (pdgaEventId && !isValidPdgaId(pdgaEventId)) {
    addFieldError(fieldErrors, 'pdgaEventId', 'PDGA-tapahtuma-ID pitää olla positiivinen kokonaisluku.');
  }

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

export function findTournament(tournaments, tournamentId) {
  return tournaments.find((tournament) => tournament.id === tournamentId) || null;
}

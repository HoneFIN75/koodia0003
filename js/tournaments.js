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

const ALLOWED_DIVISIONS = ['', 'MPO', 'FPO'];
const ALLOWED_MULTIPLIERS = new Map(MULTIPLIER_OPTIONS.map((option) => [option.key, option.value]));

function createId(prefix = 'tournament') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function normalizeText(value) {
  return String(value ?? '').trim();
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

export function validateTournamentInput(input) {
  const name = normalizeText(input.name);
  const startDate = normalizeText(input.startDate);
  const endDate = normalizeText(input.endDate);
  const division = normalizeText(input.division).toUpperCase();

  if (!name) {
    throw new Error('Turnauksen nimi on pakollinen.');
  }

  if (!startDate) {
    throw new Error('Alkamispäivä on pakollinen.');
  }

  if (endDate && endDate < startDate) {
    throw new Error('Päättymispäivä ei voi olla ennen alkamispäivää.');
  }

  if (!ALLOWED_DIVISIONS.includes(division)) {
    throw new Error('Turnauksen sarjarajaus voi olla vain MPO, FPO tai tyhjä.');
  }

  const multiplierData = normalizeMultiplier(input.multiplierKey);

  return {
    name,
    pdgaEventId: normalizeText(input.pdgaEventId),
    startDate,
    endDate,
    location: normalizeText(input.location),
    country: normalizeText(input.country),
    status: normalizeText(input.status),
    ...multiplierData,
    division,
    externalUrl: normalizeOptionalUrl(input.externalUrl, 'Ulkoinen URL'),
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
    if (left.startDate === right.startDate) {
      return left.name.localeCompare(right.name, 'fi');
    }

    return right.startDate.localeCompare(left.startDate);
  });
}

export function findTournament(tournaments, tournamentId) {
  return tournaments.find((tournament) => tournament.id === tournamentId) || null;
}

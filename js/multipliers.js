const MAX_NAME_LENGTH = 120;
const MAX_ABBREVIATION_LENGTH = 12;

export const DEFAULT_MULTIPLIERS = [
  {
    id: 'multiplier-major',
    orderNumber: 1,
    name: 'Major',
    abbreviation: 'MAJ',
    multiplier: 2,
  },
  {
    id: 'multiplier-national-tour',
    orderNumber: 2,
    name: 'National Tour',
    abbreviation: 'NT',
    multiplier: 1.5,
  },
  {
    id: 'multiplier-c-tier',
    orderNumber: 3,
    name: 'C-Tier',
    abbreviation: 'CT',
    multiplier: 1,
  },
];

export const LEGACY_MULTIPLIER_PRESETS = {
  'fpt-status': { name: 'Finnish Pro Tour Status', abbreviation: 'FPTS', multiplier: 0.5 },
  fpt: { name: 'Finnish Pro Tour', abbreviation: 'FPT', multiplier: 1 },
  dgpt: { name: 'DGPT', abbreviation: 'DGPT', multiplier: 3 },
  'finnish-championship': { name: 'Finnish Championship', abbreviation: 'FC', multiplier: 4 },
  'dgpt-plus': { name: 'DGPT+', abbreviation: 'DGPT+', multiplier: 4 },
  'dgpt-playoffs': { name: 'DGPT Playoffs', abbreviation: 'DGPT PO', multiplier: 5 },
  'european-championship': { name: 'European Championship', abbreviation: 'EC', multiplier: 5 },
  'pdga-major': { name: 'PDGA Major', abbreviation: 'PDGA', multiplier: 6 },
};

export class MultiplierValidationError extends Error {
  constructor(fieldErrors) {
    super(Object.values(fieldErrors)[0] || 'Kertoimen tiedoissa on virheitä.');
    this.name = 'MultiplierValidationError';
    this.fieldErrors = fieldErrors;
  }
}

function createId(prefix = 'multiplier') {
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

function normalizeOrderNumber(value, fieldErrors) {
  const normalized = normalizeText(value);
  if (!normalized) {
    addFieldError(fieldErrors, 'orderNumber', 'Järjestysnumero on pakollinen.');
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    addFieldError(fieldErrors, 'orderNumber', 'Järjestysnumeron pitää olla positiivinen kokonaisluku.');
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    addFieldError(fieldErrors, 'orderNumber', 'Järjestysnumeron pitää olla positiivinen kokonaisluku.');
    return null;
  }

  return parsed;
}

function normalizeMultiplierValue(value, fieldErrors) {
  const normalized = normalizeText(value).replace(/\s+/g, '');
  if (!normalized) {
    addFieldError(fieldErrors, 'multiplier', 'Kerroin on pakollinen.');
    return null;
  }

  if (!/^\d+(,\d+)?$/.test(normalized)) {
    addFieldError(fieldErrors, 'multiplier', 'Kerroin pitää syöttää suomalaisella desimaalierottimella (esim. 1,25).');
    return null;
  }

  const parsed = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    addFieldError(fieldErrors, 'multiplier', 'Kertoimen pitää olla nollaa suurempi luku.');
    return null;
  }

  return parsed;
}

function normalizeName(value, fieldErrors) {
  const normalized = normalizeText(value);
  if (!normalized) {
    addFieldError(fieldErrors, 'name', 'Nimi on pakollinen.');
    return '';
  }

  if (normalized.length > MAX_NAME_LENGTH) {
    addFieldError(fieldErrors, 'name', `Nimi saa olla enintään ${MAX_NAME_LENGTH} merkkiä pitkä.`);
  }

  return normalized;
}

function normalizeAbbreviation(value, fieldErrors) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) {
    addFieldError(fieldErrors, 'abbreviation', 'Lyhenne on pakollinen.');
    return '';
  }

  if (normalized.length > MAX_ABBREVIATION_LENGTH) {
    addFieldError(fieldErrors, 'abbreviation', `Lyhenne saa olla enintään ${MAX_ABBREVIATION_LENGTH} merkkiä pitkä.`);
  }

  return normalized;
}

function normalizeComparisonValue(value) {
  return normalizeText(value).toLocaleLowerCase('fi');
}

export function formatMultiplier(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '—';
  }

  return new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function sortMultipliers(multipliers) {
  return [...multipliers].sort((left, right) => {
    if (left.orderNumber !== right.orderNumber) {
      return left.orderNumber - right.orderNumber;
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

export function findMultiplier(multipliers, multiplierId) {
  return multipliers.find((multiplier) => multiplier.id === multiplierId) || null;
}

export function validateMultiplierInput(multipliers, input, editingId = null) {
  const fieldErrors = {};
  const orderNumber = normalizeOrderNumber(input.orderNumber, fieldErrors);
  const name = normalizeName(input.name, fieldErrors);
  const abbreviation = normalizeAbbreviation(input.abbreviation, fieldErrors);
  const multiplier = normalizeMultiplierValue(input.multiplier, fieldErrors);

  if (
    Number.isInteger(orderNumber) &&
    multipliers.some((item) => item.id !== editingId && Number(item.orderNumber) === orderNumber)
  ) {
    addFieldError(fieldErrors, 'orderNumber', `Järjestysnumero ${orderNumber} on jo käytössä.`);
  }

  if (
    name &&
    multipliers.some((item) => item.id !== editingId && normalizeComparisonValue(item.name) === normalizeComparisonValue(name))
  ) {
    addFieldError(fieldErrors, 'name', `Nimi ${name} on jo käytössä.`);
  }

  if (
    abbreviation &&
    multipliers.some(
      (item) => item.id !== editingId && normalizeComparisonValue(item.abbreviation) === normalizeComparisonValue(abbreviation),
    )
  ) {
    addFieldError(fieldErrors, 'abbreviation', `Lyhenne ${abbreviation} on jo käytössä.`);
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new MultiplierValidationError(fieldErrors);
  }

  return {
    orderNumber,
    name,
    abbreviation,
    multiplier,
  };
}

export function createMultiplier(multipliers, input) {
  const now = new Date().toISOString();

  return {
    ...validateMultiplierInput(multipliers, input),
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateMultiplier(multipliers, multiplierId, input) {
  const existing = findMultiplier(multipliers, multiplierId);
  if (!existing) {
    throw new Error('Muokattavaa kerrointa ei löytynyt.');
  }

  return {
    ...existing,
    ...validateMultiplierInput(multipliers, input, multiplierId),
    updatedAt: new Date().toISOString(),
  };
}

export function removeMultiplier(multipliers, multiplierId) {
  const existing = findMultiplier(multipliers, multiplierId);
  if (!existing) {
    throw new Error('Poistettavaa kerrointa ei löytynyt.');
  }

  return multipliers.filter((multiplier) => multiplier.id !== multiplierId);
}

function buildAbbreviationFromName(name, fallbackNumber) {
  const fromWords = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const candidate = normalizeText(fromWords).slice(0, MAX_ABBREVIATION_LENGTH);
  if (candidate) {
    return candidate;
  }

  return `K${fallbackNumber}`;
}

export function ensureLegacyMultiplier(multipliers, { status = '', multiplierKey = '', multiplier = '' } = {}) {
  const normalizedKey = normalizeText(multiplierKey);
  const preset = LEGACY_MULTIPLIER_PRESETS[normalizedKey] || null;
  const normalizedStatus = normalizeText(status);
  const parsedMultiplier = Number(multiplier);

  let nextName = preset?.name || normalizedStatus;
  let nextMultiplier = preset?.multiplier;

  if (!Number.isFinite(nextMultiplier) || nextMultiplier <= 0) {
    if (Number.isFinite(parsedMultiplier) && parsedMultiplier > 0) {
      nextMultiplier = parsedMultiplier;
    }
  }

  if (!nextName && Number.isFinite(nextMultiplier) && nextMultiplier > 0) {
    nextName = `Kerroin ${formatMultiplier(nextMultiplier)}`;
  }

  if (!nextName || !Number.isFinite(nextMultiplier) || nextMultiplier <= 0) {
    return { multipliers, multiplierId: '' };
  }

  const existingByValueAndName = multipliers.find(
    (item) => Number(item.multiplier) === Number(nextMultiplier) && normalizeComparisonValue(item.name) === normalizeComparisonValue(nextName),
  );
  if (existingByValueAndName) {
    return { multipliers, multiplierId: existingByValueAndName.id };
  }

  const orderNumber =
    multipliers.reduce((maxValue, item) => {
      const parsedOrder = Number(item.orderNumber);
      return Number.isInteger(parsedOrder) && parsedOrder > maxValue ? parsedOrder : maxValue;
    }, 0) + 1;

  let abbreviation = normalizeText(preset?.abbreviation || buildAbbreviationFromName(nextName, orderNumber)).toUpperCase();
  const usedAbbreviations = new Set(multipliers.map((item) => normalizeComparisonValue(item.abbreviation)));
  if (usedAbbreviations.has(normalizeComparisonValue(abbreviation))) {
    abbreviation = `${abbreviation.slice(0, Math.max(MAX_ABBREVIATION_LENGTH - 2, 1))}${orderNumber}`.slice(
      0,
      MAX_ABBREVIATION_LENGTH,
    );
  }

  const now = new Date().toISOString();
  const created = {
    id: createId('multiplier-legacy'),
    orderNumber,
    name: nextName.slice(0, MAX_NAME_LENGTH),
    abbreviation: abbreviation || `K${orderNumber}`,
    multiplier: nextMultiplier,
    createdAt: now,
    updatedAt: now,
  };

  return {
    multipliers: sortMultipliers([...multipliers, created]),
    multiplierId: created.id,
  };
}

export function createDefaultMultipliers() {
  return DEFAULT_MULTIPLIERS.map((item) => ({
    ...item,
    createdAt: '',
    updatedAt: '',
  }));
}

export function sanitizeMultiplier(input = {}) {
  const multiplier = Number(input.multiplier);
  const orderNumber = Number(input.orderNumber);
  const name = normalizeText(input.name);
  const abbreviation = normalizeText(input.abbreviation).toUpperCase();

  if (
    !input.id ||
    !Number.isInteger(orderNumber) ||
    orderNumber <= 0 ||
    !name ||
    !abbreviation ||
    !Number.isFinite(multiplier) ||
    multiplier <= 0
  ) {
    return null;
  }

  return {
    id: input.id,
    orderNumber,
    name: name.slice(0, MAX_NAME_LENGTH),
    abbreviation: abbreviation.slice(0, MAX_ABBREVIATION_LENGTH),
    multiplier,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function sanitizeMultipliers(multipliers = []) {
  const sanitized = Array.isArray(multipliers)
    ? multipliers.map((entry) => sanitizeMultiplier(entry)).filter(Boolean)
    : [];

  if (!sanitized.length) {
    return createDefaultMultipliers();
  }

  const usedOrderNumbers = new Set();
  const usedAbbreviations = new Set();
  const usedNames = new Set();
  const deduplicated = [];

  sanitized.forEach((entry) => {
    const normalizedAbbreviation = normalizeComparisonValue(entry.abbreviation);
    const normalizedName = normalizeComparisonValue(entry.name);
    if (
      usedOrderNumbers.has(entry.orderNumber) ||
      usedAbbreviations.has(normalizedAbbreviation) ||
      usedNames.has(normalizedName)
    ) {
      return;
    }

    usedOrderNumbers.add(entry.orderNumber);
    usedAbbreviations.add(normalizedAbbreviation);
    usedNames.add(normalizedName);
    deduplicated.push(entry);
  });

  return deduplicated.length ? sortMultipliers(deduplicated) : createDefaultMultipliers();
}

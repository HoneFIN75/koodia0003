export const POINT_DECIMALS_OPTIONS = [0, 1, 2, 3, 4];

export const DEFAULT_POINT_DECIMALS = 2;

export const DEFAULT_PDGA_SETTINGS = {
  playerBaseUrl: 'https://www.pdga.com/player/',
  eventBaseUrl: 'https://www.pdga.com/tour/event/',
  pointDecimals: DEFAULT_POINT_DECIMALS,
};

export class SettingsValidationError extends Error {
  constructor(fieldErrors) {
    super(Object.values(fieldErrors)[0] || 'Asetuksissa on virheitä.');
    this.name = 'SettingsValidationError';
    this.fieldErrors = fieldErrors;
  }
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function parsePositiveInteger(value) {
  const normalized = normalizeText(value);
  if (!normalized || !/^\d+$/.test(normalized)) {
    return '';
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : '';
}

function addFieldError(fieldErrors, fieldName, message) {
  if (!fieldErrors[fieldName]) {
    fieldErrors[fieldName] = message;
  }
}

function normalizePdgaBaseUrl(value, fallbackValue) {
  const normalized = normalizeText(value) || fallbackValue;

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }

    parsed.search = '';
    parsed.hash = '';
    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname = `${parsed.pathname}/`;
    }

    return parsed.toString();
  } catch {
    return normalizeText(fallbackValue);
  }
}

function normalizePdgaBaseUrlInput(value, label, fieldName, fieldErrors, fallbackValue) {
  const normalized = normalizeText(value);
  if (!normalized) {
    addFieldError(fieldErrors, fieldName, `${label} on pakollinen.`);
    return normalizeText(fallbackValue);
  }

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }

    parsed.search = '';
    parsed.hash = '';
    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname = `${parsed.pathname}/`;
    }

    return parsed.toString();
  } catch {
    addFieldError(fieldErrors, fieldName, `${label} ei ole kelvollinen verkko-osoite.`);
    return normalizeText(fallbackValue);
  }
}

function extractIdFromPattern(value, pattern) {
  const directValue = parsePositiveInteger(value);
  if (directValue !== '') {
    return directValue;
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  const match = normalized.match(pattern);
  if (!match?.[1]) {
    return '';
  }

  return parsePositiveInteger(match[1]);
}

export function sanitizePointDecimals(value, fallbackValue = DEFAULT_POINT_DECIMALS) {
  const normalized = normalizeText(value);
  if (!/^\d+$/.test(normalized)) {
    return fallbackValue;
  }

  const parsed = Number(normalized);
  return POINT_DECIMALS_OPTIONS.includes(parsed) ? parsed : fallbackValue;
}

export function sanitizePdgaSettings(settings = {}) {
  return {
    playerBaseUrl: normalizePdgaBaseUrl(settings.playerBaseUrl, DEFAULT_PDGA_SETTINGS.playerBaseUrl),
    eventBaseUrl: normalizePdgaBaseUrl(settings.eventBaseUrl, DEFAULT_PDGA_SETTINGS.eventBaseUrl),
    pointDecimals: sanitizePointDecimals(settings.pointDecimals),
  };
}

function normalizePointDecimalsInput(value, fieldErrors) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return DEFAULT_POINT_DECIMALS;
  }

  const parsed = Number(normalized);
  if (!/^\d+$/.test(normalized) || !POINT_DECIMALS_OPTIONS.includes(parsed)) {
    addFieldError(fieldErrors, 'pointDecimals', 'Pyöristys pitää olla arvo väliltä 0–4.');
    return DEFAULT_POINT_DECIMALS;
  }

  return parsed;
}

export function validateSettingsInput(input = {}) {
  const fieldErrors = {};
  const settings = {
    playerBaseUrl: normalizePdgaBaseUrlInput(
      input.playerBaseUrl,
      'PDGA-pelaajaosoitteen perus-URL',
      'playerBaseUrl',
      fieldErrors,
      DEFAULT_PDGA_SETTINGS.playerBaseUrl,
    ),
    eventBaseUrl: normalizePdgaBaseUrlInput(
      input.eventBaseUrl,
      'PDGA-kilpailuosoitteen perus-URL',
      'eventBaseUrl',
      fieldErrors,
      DEFAULT_PDGA_SETTINGS.eventBaseUrl,
    ),
    pointDecimals: normalizePointDecimalsInput(input.pointDecimals, fieldErrors),
  };

  if (Object.keys(fieldErrors).length > 0) {
    throw new SettingsValidationError(fieldErrors);
  }

  return settings;
}

export function extractPdgaPlayerId(value) {
  return extractIdFromPattern(value, /\/player\/(\d+)(?:[/?#]|$)/i);
}

export function extractPdgaEventId(value) {
  return extractIdFromPattern(value, /\/tour\/event\/(\d+)(?:[/?#]|$)/i);
}

export function buildPdgaPlayerUrl(settings = {}, player = {}) {
  const pdgaPlayerId = extractPdgaPlayerId(player.pdgaNumber);
  if (pdgaPlayerId === '') {
    return '';
  }

  const { playerBaseUrl } = sanitizePdgaSettings(settings);
  return new URL(String(pdgaPlayerId), playerBaseUrl).toString();
}

export function buildPdgaEventUrl(settings = {}, tournament = {}) {
  const pdgaEventId = extractPdgaEventId(tournament.pdgaEventId);
  if (pdgaEventId === '') {
    return '';
  }

  const { eventBaseUrl } = sanitizePdgaSettings(settings);
  return new URL(String(pdgaEventId), eventBaseUrl).toString();
}

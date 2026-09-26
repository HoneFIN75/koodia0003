export const DEFAULT_PDGA_PLAYER_BASE_URL = 'https://www.pdga.com/player/';
export const DEFAULT_PDGA_EVENT_BASE_URL = 'https://www.pdga.com/tour/event/';

function normalizeText(value) {
  return String(value ?? '').trim();
}

export function createDefaultPdgaSettings() {
  return {
    pdgaPlayerBaseUrl: DEFAULT_PDGA_PLAYER_BASE_URL,
    pdgaEventBaseUrl: DEFAULT_PDGA_EVENT_BASE_URL,
  };
}

export function normalizePdgaBaseUrl(value, fallbackUrl) {
  const fallback = normalizeText(fallbackUrl);
  const candidate = normalizeText(value) || fallback;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('URL ei ole kelvollinen verkko-osoite.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL ei ole kelvollinen verkko-osoite.');
  }

  return parsed.toString().replace(/\/?$/, '/');
}

export function sanitizePdgaSettings(candidate = {}) {
  const defaults = createDefaultPdgaSettings();
  let pdgaPlayerBaseUrl = defaults.pdgaPlayerBaseUrl;
  let pdgaEventBaseUrl = defaults.pdgaEventBaseUrl;

  try {
    pdgaPlayerBaseUrl = normalizePdgaBaseUrl(candidate.pdgaPlayerBaseUrl, defaults.pdgaPlayerBaseUrl);
  } catch {
    pdgaPlayerBaseUrl = defaults.pdgaPlayerBaseUrl;
  }

  try {
    pdgaEventBaseUrl = normalizePdgaBaseUrl(candidate.pdgaEventBaseUrl, defaults.pdgaEventBaseUrl);
  } catch {
    pdgaEventBaseUrl = defaults.pdgaEventBaseUrl;
  }

  return { pdgaPlayerBaseUrl, pdgaEventBaseUrl };
}

export function normalizePdgaId(value) {
  return normalizeText(value);
}

export function isValidPdgaId(value) {
  return /^0*[1-9]\d*$/.test(value);
}

export function extractPdgaIdFromValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (isValidPdgaId(normalized)) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    const pathSegments = parsed.pathname.split('/').map((segment) => segment.trim()).filter(Boolean);
    for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
      if (pathSegments[index]) {
        return pathSegments[index];
      }
    }
  } catch {
    const match = normalized.match(/([A-Za-z0-9_-]+)(?:\/)?$/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return '';
}

export function buildPdgaReferenceUrl(baseUrl, id) {
  const normalizedId = normalizePdgaId(id);
  if (!normalizedId) {
    return '';
  }

  return `${normalizePdgaBaseUrl(baseUrl, baseUrl)}${encodeURIComponent(normalizedId)}`;
}

import { getAuthHeaders } from './auth.js';

// Keskitetty virheloki: virheet lähetetään palvelimelle, joka tallentaa ne jsondb/errors.json-tiedostoon.
// Lokitus ei saa koskaan katkaista käyttäjän toimintoa, joten epäonnistuminen ohitetaan hiljaa.
export const ERROR_LOG_MAX_ENTRIES_PER_REQUEST = 200;

function getErrorLogApiUrl(moduleUrl = import.meta.url) {
  return new URL('../api/errors', moduleUrl);
}

export async function logErrors(
  source,
  entries = [],
  { fetchImpl = globalThis.fetch, moduleUrl = import.meta.url } = {},
) {
  const errors = entries
    .filter((entry) => entry && String(entry.message ?? '').trim())
    .slice(0, ERROR_LOG_MAX_ENTRIES_PER_REQUEST)
    .map((entry) => ({
      message: String(entry.message),
      ...(Number.isSafeInteger(entry.rowNumber) ? { rowNumber: entry.rowNumber } : {}),
      ...(entry.pdgaId ? { pdgaId: String(entry.pdgaId) } : {}),
      ...(entry.column ? { column: String(entry.column) } : {}),
    }));

  if (!errors.length || typeof fetchImpl !== 'function') {
    return false;
  }

  try {
    const response = await fetchImpl(getErrorLogApiUrl(moduleUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ source, errors }),
    });
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

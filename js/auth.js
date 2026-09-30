// Väliaikainen jaetun salasanan tunnistautuminen. Moduuli on tarkoituksella eristetty,
// jotta se voidaan myöhemmin korvata varsinaisella kirjautumisella ilman muutoksia muualle.

export const AUTH_STORAGE_KEY = 'sfl-pisteytystyokalu-auth-v1';
export const AUTH_TOKEN_HEADER = 'X-SFL-Auth-Token';
export const SITE_PASSWORD_MIN_LENGTH = 8;
export const SITE_PASSWORD_MAX_LENGTH = 200;

export class AuthRequiredError extends Error {
  constructor(message = 'Kirjautuminen vaaditaan. Kirjaudu sisään uudelleen.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }

  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function getAuthToken({ storage } = {}) {
  try {
    return String(resolveStorage(storage)?.getItem(AUTH_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function storeAuthToken(token, { storage } = {}) {
  try {
    resolveStorage(storage)?.setItem(AUTH_STORAGE_KEY, String(token));
  } catch {
    // Tallennus voi epäonnistua esim. yksityisessä selaustilassa; istunto kestää silloin vain sivun ajan.
  }
}

export function clearAuthToken({ storage } = {}) {
  try {
    resolveStorage(storage)?.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ei toimenpiteitä.
  }
}

export function isAuthenticated(options = {}) {
  return getAuthToken(options) !== '';
}

export function getAuthHeaders(options = {}) {
  const token = getAuthToken(options);
  return token ? { [AUTH_TOKEN_HEADER]: token } : {};
}

function getApiUrl(endpoint, moduleUrl = import.meta.url) {
  return new URL(`../api/${endpoint}`, moduleUrl);
}

async function readMessage(response, fallbackMessage) {
  try {
    const payload = await response.json();
    if (payload && typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
  } catch {
    // Käytetään oletusviestiä.
  }

  return fallbackMessage;
}

export async function login(
  password,
  { fetchImpl = globalThis.fetch, moduleUrl = import.meta.url, storage } = {},
) {
  if (!String(password ?? '')) {
    throw new Error('Syötä salasana.');
  }

  let response;
  try {
    response = await fetchImpl(getApiUrl('login', moduleUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ password: String(password) }),
    });
  } catch {
    throw new Error('Kirjautuminen epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen.');
  }

  if (response.status === 401) {
    throw new Error('Väärä salasana. Yritä uudelleen.');
  }

  if (!response.ok) {
    throw new Error(await readMessage(response, 'Kirjautuminen epäonnistui. Yritä uudelleen hetken kuluttua.'));
  }

  let token = '';
  try {
    token = String((await response.json())?.token || '').trim();
  } catch {
    token = '';
  }

  if (!token) {
    throw new Error('Palvelimen vastausta ei voitu lukea.');
  }

  storeAuthToken(token, { storage });
  return token;
}

export function logout(options = {}) {
  clearAuthToken(options);
}

export function validateSitePasswordInput(password) {
  const value = String(password ?? '');
  const length = [...value].length;
  if (!value.trim()) {
    return 'Syötä uusi salasana.';
  }

  if (length < SITE_PASSWORD_MIN_LENGTH || length > SITE_PASSWORD_MAX_LENGTH) {
    return `Salasanan pituuden pitää olla ${SITE_PASSWORD_MIN_LENGTH}–${SITE_PASSWORD_MAX_LENGTH} merkkiä.`;
  }

  return '';
}

export async function changeSitePassword(
  password,
  { fetchImpl = globalThis.fetch, moduleUrl = import.meta.url, storage } = {},
) {
  const validationError = validateSitePasswordInput(password);
  if (validationError) {
    throw new Error(validationError);
  }

  let response;
  try {
    response = await fetchImpl(getApiUrl('site-password', moduleUrl), {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...getAuthHeaders({ storage }),
      },
      cache: 'no-store',
      body: JSON.stringify({ password: String(password) }),
    });
  } catch {
    throw new Error('Salasanan tallentaminen epäonnistui. Yritä uudelleen hetken kuluttua.');
  }

  if (response.status === 401) {
    throw new AuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(await readMessage(response, 'Salasanan tallentaminen epäonnistui.'));
  }
}

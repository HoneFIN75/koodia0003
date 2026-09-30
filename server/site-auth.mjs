import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export const SITE_AUTH_SETTING_KEYS = ['sitePassword', 'sitePasswordHash', 'authSecret'];
export const DEFAULT_SITE_PASSWORD = 'sfl-pisteet-2026';
export const SITE_PASSWORD_MIN_LENGTH = 8;
export const SITE_PASSWORD_MAX_LENGTH = 200;

const SETTINGS_FILE_NAME = 'settings.json';
const TOKEN_PATTERN = /^([a-f0-9]{32})\.([a-f0-9]{64})$/;

const settingsFileLocks = new Map();

export function withSettingsFileLock(directoryPath, task) {
  const lockKey = path.resolve(directoryPath);
  const previous = settingsFileLocks.get(lockKey) || Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.catch(() => {});
  settingsFileLocks.set(lockKey, settled);
  settled.then(() => {
    if (settingsFileLocks.get(lockKey) === settled) {
      settingsFileLocks.delete(lockKey);
    }
  });
  return run;
}

export function stripSiteAuthSettings(settings = {}) {
  const stripped = { ...settings };
  SITE_AUTH_SETTING_KEYS.forEach((key) => {
    delete stripped[key];
  });
  return stripped;
}

export function pickSiteAuthSettings(settings = {}) {
  return Object.fromEntries(
    SITE_AUTH_SETTING_KEYS
      .filter((key) => typeof settings?.[key] === 'string' && settings[key] !== '')
      .map((key) => [key, settings[key]]),
  );
}

export async function readSettingsFile(directoryPath) {
  try {
    const parsed = JSON.parse(await readFile(path.join(directoryPath, SETTINGS_FILE_NAME), 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPasswordHash(password, storedHash) {
  const [algorithm, saltHex, hashHex] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length === 0) {
    return false;
  }

  const derivedKey = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(derivedKey, expected);
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left), 'utf8');
  const rightBuffer = Buffer.from(String(right), 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signNonce(nonce, secret) {
  return createHmac('sha256', secret).update(nonce).digest('hex');
}

export function validateSitePasswordLength(password) {
  const length = [...String(password ?? '')].length;
  return String(password ?? '').trim() !== ''
    && length >= SITE_PASSWORD_MIN_LENGTH
    && length <= SITE_PASSWORD_MAX_LENGTH;
}

export class SiteAuth {
  constructor({ directoryPath }) {
    this.directoryPath = directoryPath;
  }

  async #writeAuthConfig(authConfig) {
    await mkdir(this.directoryPath, { recursive: true });
    const filePath = path.join(this.directoryPath, SETTINGS_FILE_NAME);
    const settings = { ...stripSiteAuthSettings(await readSettingsFile(this.directoryPath)), ...authConfig };
    const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    await rename(tempPath, filePath);
  }

  async #ensureAuthConfig() {
    const authConfig = pickSiteAuthSettings(await readSettingsFile(this.directoryPath));
    let changed = false;

    if (!authConfig.authSecret) {
      authConfig.authSecret = randomBytes(32).toString('hex');
      changed = true;
    }

    if (!authConfig.sitePasswordHash && !authConfig.sitePassword) {
      authConfig.sitePasswordHash = await hashPassword(DEFAULT_SITE_PASSWORD);
      changed = true;
    }

    if (changed) {
      await this.#writeAuthConfig(authConfig);
    }

    return authConfig;
  }

  #locked(task) {
    return withSettingsFileLock(this.directoryPath, task);
  }

  verifyPassword(password) {
    return this.#locked(() => this.#verifyPassword(password));
  }

  createToken() {
    return this.#locked(() => this.#createToken());
  }

  isValidToken(token) {
    return this.#locked(() => this.#isValidToken(token));
  }

  setPassword(password) {
    return this.#locked(() => this.#setPassword(password));
  }

  async #verifyPassword(password) {
    const authConfig = await this.#ensureAuthConfig();
    const candidate = String(password ?? '');
    if (!candidate) {
      return false;
    }

    if (authConfig.sitePasswordHash) {
      return verifyPasswordHash(candidate, authConfig.sitePasswordHash);
    }

    if (!safeEqualText(authConfig.sitePassword, candidate)) {
      return false;
    }

    delete authConfig.sitePassword;
    authConfig.sitePasswordHash = await hashPassword(candidate);
    await this.#writeAuthConfig(authConfig);
    return true;
  }

  async #createToken() {
    const { authSecret } = await this.#ensureAuthConfig();
    const nonce = randomBytes(16).toString('hex');
    return `${nonce}.${signNonce(nonce, authSecret)}`;
  }

  async #isValidToken(token) {
    const match = TOKEN_PATTERN.exec(String(token ?? '').trim());
    if (!match) {
      return false;
    }

    const { authSecret } = await this.#ensureAuthConfig();
    return safeEqualText(signNonce(match[1], authSecret), match[2]);
  }

  async #setPassword(password) {
    const authConfig = await this.#ensureAuthConfig();
    delete authConfig.sitePassword;
    authConfig.sitePasswordHash = await hashPassword(String(password));
    await this.#writeAuthConfig(authConfig);
  }
}

export function createSiteAuth(options) {
  return new SiteAuth(options);
}

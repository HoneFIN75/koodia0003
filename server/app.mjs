import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import {
  SITE_PASSWORD_MAX_LENGTH,
  SITE_PASSWORD_MIN_LENGTH,
  validateSitePasswordLength,
} from './site-auth.mjs';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const ALLOWED_PUBLIC_ENTRIES = new Set(['index.html', 'css', 'js', 'assets', 'version.json']);

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  response.end(body);
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

async function readRequestJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

function isLoopbackAddress(remoteAddress = '') {
  return remoteAddress === '127.0.0.1'
    || remoteAddress === '::1'
    || remoteAddress === '::ffff:127.0.0.1';
}

function defaultAuthorizeWriteRequest(request) {
  const configuredToken = String(process.env.SFL_API_WRITE_TOKEN || '').trim();
  const headerToken = String(request.headers['x-sfl-write-token'] || '').trim();
  const proxyAuthorized = String(request.headers['x-sfl-proxy-authenticated'] || '').trim() === 'true';

  if (isLoopbackAddress(request.socket?.remoteAddress)) {
    return true;
  }

  if (configuredToken && proxyAuthorized && headerToken === configuredToken) {
    return true;
  }

  return false;
}

async function isAuthenticatedRequest(request, siteAuth) {
  if (!siteAuth) {
    return true;
  }

  return siteAuth.isValidToken(String(request.headers['x-sfl-auth-token'] || '').trim());
}

function sendAuthRequired(response) {
  sendJson(response, 401, { message: 'Kirjautuminen vaaditaan. Kirjaudu sisään uudelleen.' });
}

function readPasswordFromPayload(payload) {
  return payload && typeof payload === 'object' && typeof payload.password === 'string' ? payload.password : '';
}

async function handleLoginRequest(request, response, siteAuth) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { message: 'Metodia ei tueta.' }, { Allow: 'POST' });
    return;
  }

  const password = readPasswordFromPayload(await readRequestJson(request));
  if (!password || !(await siteAuth.verifyPassword(password))) {
    sendJson(response, 401, { message: 'Väärä salasana. Yritä uudelleen.' });
    return;
  }

  sendJson(response, 200, { token: await siteAuth.createToken() });
}

async function handleSitePasswordRequest(request, response, siteAuth, authorizeWriteRequest) {
  if (request.method !== 'PUT') {
    sendJson(response, 405, { message: 'Metodia ei tueta.' }, { Allow: 'PUT' });
    return;
  }

  if (!(await isAuthenticatedRequest(request, siteAuth))) {
    sendAuthRequired(response);
    return;
  }

  if (!authorizeWriteRequest(request)) {
    sendJson(response, 403, {
      message: 'Tallennus on sallittu vain paikallisen palvelimen kautta tai suojatulla välityspalvelimella.',
    });
    return;
  }

  const password = readPasswordFromPayload(await readRequestJson(request));
  if (!validateSitePasswordLength(password)) {
    sendJson(response, 400, {
      message: `Salasanan pituuden pitää olla ${SITE_PASSWORD_MIN_LENGTH}–${SITE_PASSWORD_MAX_LENGTH} merkkiä.`,
    });
    return;
  }

  await siteAuth.setPassword(password);
  sendJson(response, 200, { message: 'Sivuston salasana tallennettiin.' });
}

function validateStatePayload(payload) {
  const requiredKeys = [
    'players',
    'tournaments',
    'resultCards',
    'settings',
    'pointsTable',
    'multipliers',
  ];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_STATE_PAYLOAD');
  }

  const missingKeys = requiredKeys.filter((key) => !(key in payload));
  if (missingKeys.length > 0) {
    throw new Error('INCOMPLETE_STATE_PAYLOAD');
  }

  return payload;
}

function resolvePublicPath(publicDir, pathname) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const decodedPath = decodeURIComponent(normalizedPath);
  const topLevelEntry = decodedPath.replace(/^\/+/, '').split('/')[0];
  if (!ALLOWED_PUBLIC_ENTRIES.has(topLevelEntry)) {
    return null;
  }
  const absolutePath = path.resolve(publicDir, `.${decodedPath}`);
  const publicRoot = path.resolve(publicDir);

  if (!absolutePath.startsWith(`${publicRoot}${path.sep}`) && absolutePath !== publicRoot) {
    return null;
  }

  return absolutePath;
}

async function serveStaticFile(request, response, publicDir, pathname) {
  const filePath = resolvePublicPath(publicDir, pathname);
  if (!filePath) {
    sendText(response, 404, 'Tiedostoa ei löytynyt.');
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      sendText(response, 404, 'Tiedostoa ei löytynyt.');
      return;
    }

    const headers = {
      'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': fileStats.size,
      'Cache-Control': path.basename(filePath) === 'version.json' ? 'no-store' : 'public, max-age=0',
    };
    response.writeHead(200, headers);

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    await new Promise((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on('error', reject);
      response.on('close', resolve);
      response.on('finish', resolve);
      stream.pipe(response);
    });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendText(response, 404, 'Tiedostoa ei löytynyt.');
      return;
    }

    throw error;
  }
}

export function createRequestHandler({
  storage,
  publicDir,
  authorizeWriteRequest = defaultAuthorizeWriteRequest,
  siteAuth = null,
}) {
  return async function requestHandler(request, response) {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');

      if (url.pathname === '/api/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }

      if (siteAuth && url.pathname === '/api/login') {
        await handleLoginRequest(request, response, siteAuth);
        return;
      }

      if (siteAuth && url.pathname === '/api/site-password') {
        await handleSitePasswordRequest(request, response, siteAuth, authorizeWriteRequest);
        return;
      }

      if (url.pathname === '/api/state') {
        if ((request.method === 'GET' || request.method === 'PUT') && !(await isAuthenticatedRequest(request, siteAuth))) {
          sendAuthRequired(response);
          return;
        }

        if (request.method === 'GET') {
          sendJson(response, 200, await storage.loadState());
          return;
        }

        if (request.method === 'PUT') {
          if (!authorizeWriteRequest(request)) {
            sendJson(response, 403, {
              message: 'Tallennus on sallittu vain paikallisen palvelimen kautta tai suojatulla välityspalvelimella.',
            });
            return;
          }

          const payload = validateStatePayload(await readRequestJson(request));
          sendJson(response, 200, await storage.saveState(payload));
          return;
        }

        sendJson(response, 405, { message: 'Metodia ei tueta.' }, { Allow: 'GET, PUT' });
        return;
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { message: 'Metodia ei tueta.' }, { Allow: 'GET, HEAD' });
        return;
      }

      await serveStaticFile(request, response, publicDir, url.pathname);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { message: 'Pyynnön JSON-data on virheellinen.' });
        return;
      }

      if (error instanceof URIError) {
        sendJson(response, 400, { message: 'Pyynnön osoite ei ole kelvollinen.' });
        return;
      }

      if (error?.message === 'INVALID_STATE_PAYLOAD' || error?.message === 'INCOMPLETE_STATE_PAYLOAD') {
        sendJson(response, 400, {
          message: 'Tallennettava tila on puutteellinen. Lähetä koko sovelluksen tila yhdessä pyynnössä.',
        });
        return;
      }

      sendJson(response, 500, { message: 'Palvelimella tapahtui virhe tallennuksen aikana.' });
    }
  };
}

export function createServer(options) {
  return http.createServer(createRequestHandler(options));
}

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(response, statusCode, payload) {
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
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

function isAuthorizedWriteRequest(request) {
  const configuredToken = String(process.env.SFL_API_WRITE_TOKEN || '').trim();
  const headerToken = String(request.headers['x-sfl-write-token'] || '').trim();

  if (configuredToken && headerToken === configuredToken) {
    return true;
  }

  return isLoopbackAddress(request.socket?.remoteAddress);
}

function resolvePublicPath(publicDir, pathname) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const decodedPath = decodeURIComponent(normalizedPath);
  const absolutePath = path.resolve(publicDir, `.${decodedPath}`);
  const publicRoot = path.resolve(publicDir);

  if (!absolutePath.startsWith(`${publicRoot}${path.sep}`) && absolutePath !== publicRoot) {
    return null;
  }

  return absolutePath;
}

async function serveStaticFile(response, publicDir, pathname) {
  const filePath = resolvePublicPath(publicDir, pathname);
  if (!filePath) {
    sendText(response, 403, 'Pääsy estetty.');
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      sendText(response, 404, 'Tiedostoa ei löytynyt.');
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': path.basename(filePath) === 'version.json' ? 'no-store' : 'public, max-age=0',
    });
    response.end(body);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendText(response, 404, 'Tiedostoa ei löytynyt.');
      return;
    }

    throw error;
  }
}

export function createRequestHandler({ storage, publicDir }) {
  return async function requestHandler(request, response) {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');

      if (url.pathname === '/api/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }

      if (url.pathname === '/api/state') {
        if (request.method === 'GET') {
          sendJson(response, 200, await storage.loadState());
          return;
        }

        if (request.method === 'PUT') {
          if (!isAuthorizedWriteRequest(request)) {
            sendJson(response, 403, {
              message: 'Tallennus on sallittu vain paikallisen palvelimen kautta tai suojatulla välityspalvelimella.',
            });
            return;
          }

          const payload = await readRequestJson(request);
          sendJson(response, 200, await storage.saveState(payload));
          return;
        }

        sendJson(response, 405, { message: 'Metodia ei tueta.' });
        return;
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { message: 'Metodia ei tueta.' });
        return;
      }

      await serveStaticFile(response, publicDir, url.pathname);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { message: 'Pyynnön JSON-data on virheellinen.' });
        return;
      }

      sendJson(response, 500, { message: 'Palvelimella tapahtui virhe tallennuksen aikana.' });
    }
  };
}

export function createServer(options) {
  return http.createServer(createRequestHandler(options));
}

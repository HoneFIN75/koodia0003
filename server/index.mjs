import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './app.mjs';
import { createJsonFileStorage } from './json-file-storage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function resolveFromRoot(relativePath, fallbackPath) {
  return path.resolve(rootDir, relativePath || fallbackPath);
}

export function createApplication({
  publicDir = resolveFromRoot(process.env.PUBLIC_DIR, '.'),
  jsondbDir = resolveFromRoot(process.env.JSONDB_DIR, 'jsondb'),
} = {}) {
  const storage = createJsonFileStorage({ directoryPath: jsondbDir });
  return createServer({ publicDir, storage });
}

if (process.argv[1] === __filename) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const server = createApplication();

  server.listen(port, host, () => {
    console.log(`SFL Pisteytystyökalu kuuntelee osoitteessa http://${host}:${port}`);
  });
}

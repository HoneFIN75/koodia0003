import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

async function ensureSourceExists(targetPath) {
  await stat(targetPath);
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const itemsToCopy = ['index.html', 'css', 'js', 'assets'];

  for (const item of itemsToCopy) {
    const sourcePath = path.join(rootDir, item);
    const destinationPath = path.join(distDir, item);
    await ensureSourceExists(sourcePath);
    await cp(sourcePath, destinationPath, { recursive: true });
  }

  console.log('Build valmis:', distDir);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

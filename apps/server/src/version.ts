import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// '../package.json' resolves from both src/version.ts (dev/test) and the bundled
// dist/index.js (npm + Docker), keeping package.json the single source of the version.
const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

export const VERSION = pkg.version;

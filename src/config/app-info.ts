import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// package.json sits two levels up from both src/config/ (dev) and dist/config/ (build).
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
  name: string;
  version: string;
};

export const appInfo = {
  name: pkg.name,
  version: pkg.version,
} as const;

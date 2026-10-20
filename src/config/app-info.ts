import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Every way of running the app (npm scripts, the test runner, `node dist/server.js` in Docker)
// starts from the project root, where package.json lives.
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  name: string;
  version: string;
};

export const appInfo = {
  name: pkg.name,
  version: pkg.version,
} as const;

import type { AuthContext } from '../lib/tokens';

// Teaches TypeScript that, after the authenticate middleware, every request may carry `auth`.
declare global {
  namespace Express {
    interface Request {
      /** Who is calling. Set by `authenticate`; read it with `getAuth(req)`. */
      auth?: AuthContext;
    }
  }
}

export {};

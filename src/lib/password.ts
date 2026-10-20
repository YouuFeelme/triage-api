import bcrypt from 'bcryptjs';
import { env } from '../config/env';

// Each +1 doubles the time to compute a hash. 12 (the default) takes ~200-300 ms: unnoticeable
// for a login, very expensive for someone trying billions of guesses against a leaked database.
const BCRYPT_COST = env.BCRYPT_COST;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

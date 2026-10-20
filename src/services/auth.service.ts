import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { env } from '../config/env';
import { db } from '../db/database';
import { isUniqueViolation } from '../db/errors';
import type { Database, UserRole } from '../db/schema';
import { AppError } from '../errors/app-error';
import { logger } from '../lib/logger';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateRefreshToken, hashToken, signAccessToken } from '../lib/tokens';
import { refreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { usersRepository, type PublicUser } from '../repositories/users.repository';
import type { LoginInput, RegisterInput } from '../schemas/auth.schemas';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mirrors TokenPair in openapi.yaml. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/** Mirrors AuthResponse in openapi.yaml. */
export interface AuthResponse {
  user: PublicUser;
  tokens: TokenPair;
}

// Hash compared against when the email doesn't exist, so "unknown email" takes as long as
// "wrong password". Otherwise response times would reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));

/**
 * Creates a new refresh token in `familyId` and signs a fresh access token.
 * A family = one login session; every rotation stays in the same family.
 */
async function issueTokens(
  user: { id: string; role: UserRole },
  familyId: string,
  executor: Kysely<Database> = db,
): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();
  await refreshTokensRepository.create(
    {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
    },
    executor,
  );
  const accessToken = await signAccessToken({ userId: user.id, role: user.role });
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  };
}

type RotationResult =
  | { outcome: 'rotated'; tokens: TokenPair }
  | { outcome: 'invalid' }
  | { outcome: 'reused'; userId: string; familyId: string; revoked: number };

export const authService = {
  /** Everyone signs up as a customer; only an admin can promote them later. */
  async register(input: RegisterInput): Promise<AuthResponse> {
    if (await usersRepository.existsByEmail(input.email)) {
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.');
    }

    const passwordHash = await hashPassword(input.password);
    let user: PublicUser;
    try {
      user = await usersRepository.create({ email: input.email, name: input.name, passwordHash });
    } catch (err) {
      // Two sign-ups with the same email at the same instant: the UNIQUE constraint catches it.
      if (isUniqueViolation(err)) {
        throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.', {
          cause: err,
        });
      }
      throw err;
    }

    const tokens = await issueTokens(user, randomUUID());
    return { user, tokens };
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const found = await usersRepository.findByEmailWithPassword(input.email);
    const passwordMatches = await verifyPassword(
      input.password,
      found?.passwordHash ?? (await getDummyHash()),
    );

    // Same error for "no such email" and "wrong password": the API never confirms an account exists.
    if (!found || !passwordMatches) {
      throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const user: PublicUser = {
      id: found.id,
      email: found.email,
      name: found.name,
      role: found.role,
      createdAt: found.createdAt,
    };
    const tokens = await issueTokens(user, randomUUID());
    return { user, tokens };
  },

  /**
   * Rotation: the refresh token is single-use. Using it revokes it and returns a new pair.
   * Reuse detection: if a token that was ALREADY used shows up again, someone else has a copy
   * (stolen or leaked). We can't tell who is legitimate, so the whole session is revoked and
   * both parties must log in again.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(refreshToken);

    const result = await db.transaction().execute(async (trx): Promise<RotationResult> => {
      const stored = await refreshTokensRepository.findByHashForUpdate(tokenHash, trx);
      if (!stored || stored.expiresAt.getTime() <= Date.now()) {
        return { outcome: 'invalid' };
      }

      if (stored.revokedAt) {
        const revoked = await refreshTokensRepository.revokeFamily(stored.familyId, trx);
        return { outcome: 'reused', userId: stored.userId, familyId: stored.familyId, revoked };
      }

      // Read the user again: their role may have changed since they logged in.
      const user = await usersRepository.findById(stored.userId, trx);
      if (!user) return { outcome: 'invalid' };

      await refreshTokensRepository.revoke(stored.id, trx);
      const tokens = await issueTokens(user, stored.familyId, trx);
      return { outcome: 'rotated', tokens };
    });

    // Errors are thrown AFTER the transaction commits: throwing inside would roll back the
    // family revocation that protects the user.
    if (result.outcome === 'reused') {
      logger.warn(
        { userId: result.userId, familyId: result.familyId, revokedTokens: result.revoked },
        'Refresh token reuse detected: session revoked',
      );
      throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh token was already used. Log in again.');
    }
    if (result.outcome === 'invalid') {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');
    }
    return result.tokens;
  },

  /** Ends the session the token belongs to. Idempotent: unknown or revoked tokens are fine too. */
  async logout(refreshToken: string): Promise<void> {
    const stored = await refreshTokensRepository.findByHash(hashToken(refreshToken));
    if (stored) {
      await refreshTokensRepository.revokeFamily(stored.familyId);
    }
  },
};

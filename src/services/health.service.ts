import { appInfo } from '../config/app-info';
import { logger } from '../lib/logger';
import { healthRepository } from '../repositories/health.repository';

const READINESS_TIMEOUT_MS = 1_000;

/** Mirrors `Health` in openapi.yaml. */
export interface HealthStatus {
  status: 'ok';
  uptimeSeconds: number;
  version: string;
}

/** Mirrors `Readiness` in openapi.yaml. */
export interface ReadinessStatus {
  status: 'ready' | 'unavailable';
  checks: { database: 'up' | 'down' };
}

export const healthService = {
  /** Liveness: if this code runs, the process is up. Deliberately touches nothing else. */
  getStatus(): HealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime() * 10) / 10,
      version: appInfo.version,
    };
  },

  /** Readiness: can this instance actually serve requests? Today that means "is the DB reachable". */
  async getReadiness(): Promise<ReadinessStatus> {
    try {
      await healthRepository.ping(READINESS_TIMEOUT_MS);
      return { status: 'ready', checks: { database: 'up' } };
    } catch (err) {
      logger.warn({ err }, 'Readiness check failed: database is unreachable');
      return { status: 'unavailable', checks: { database: 'down' } };
    }
  },
};

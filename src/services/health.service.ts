import { appInfo } from '../config/app-info';

/** Mirrors `Health` in openapi.yaml. */
export interface HealthStatus {
  status: 'ok';
  uptimeSeconds: number;
  version: string;
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
};

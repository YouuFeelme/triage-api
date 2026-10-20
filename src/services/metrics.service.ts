import type { UserRef } from '../repositories/users.repository';
import { metricsRepository } from '../repositories/metrics.repository';
import type { MetricsRange } from '../schemas/metrics.schemas';

/** Mirrors MetricsSummary in openapi.yaml. */
export interface MetricsSummary {
  range: MetricsRange;
  totals: { created: number; resolved: number; unassigned: number };
  byStatus: { open: number; in_progress: number; resolved: number };
  byPriority: { low: number; medium: number; high: number; urgent: number };
  resolutionHours: { average: number | null; median: number | null };
  agents: { agent: UserRef; assigned: number; inProgress: number; resolved: number }[];
  openedPerDay: { date: string; count: number }[];
}

export const metricsService = {
  /** Metrics for tickets CREATED in the range. The three queries are independent: run them in parallel. */
  async summary(range: MetricsRange): Promise<MetricsSummary> {
    const [summary, agents, days] = await Promise.all([
      metricsRepository.summary(range),
      metricsRepository.perAgent(range),
      metricsRepository.openedPerDay(range),
    ]);

    return {
      range,
      totals: {
        created: summary.created,
        resolved: summary.resolved,
        // Still waiting in the queue: not resolved and nobody assigned.
        unassigned: summary.unassigned,
      },
      byStatus: {
        open: summary.statusOpen,
        in_progress: summary.statusInProgress,
        resolved: summary.statusResolved,
      },
      byPriority: {
        low: summary.priorityLow,
        medium: summary.priorityMedium,
        high: summary.priorityHigh,
        urgent: summary.priorityUrgent,
      },
      resolutionHours: {
        average: summary.avgResolutionHours,
        median: summary.medianResolutionHours,
      },
      agents: agents.map((row) => ({
        agent: { id: row.id, name: row.name, role: row.role },
        assigned: row.assigned,
        inProgress: row.inProgress,
        resolved: row.resolved,
      })),
      openedPerDay: days,
    };
  },
};

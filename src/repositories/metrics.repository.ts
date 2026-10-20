import { sql } from 'kysely';
import { db } from '../db/database';
import type { UserRole } from '../db/schema';
import type { MetricsRange } from '../schemas/metrics.schemas';

// Hand-written SQL on purpose: aggregates with FILTER, PERCENTILE_CONT, a LEFT JOIN that keeps
// agents with zero tickets, and GENERATE_SERIES to fill days with no tickets.
// Aliases are quoted camelCase so the rows come back ready to use.
// COUNT(*) returns BIGINT; database.ts parses it as a JS number.

export interface SummaryRow {
  created: number;
  resolved: number;
  unassigned: number;
  statusOpen: number;
  statusInProgress: number;
  statusResolved: number;
  priorityLow: number;
  priorityMedium: number;
  priorityHigh: number;
  priorityUrgent: number;
  avgResolutionHours: number | null;
  medianResolutionHours: number | null;
}

export interface AgentRow {
  id: string;
  name: string;
  role: UserRole;
  assigned: number;
  inProgress: number;
  resolved: number;
}

export interface DayRow {
  date: string;
  count: number;
}

/**
 * Half-open UTC range [from 00:00, day after `to` 00:00). Comparing created_at directly to two
 * timestamps (instead of casting created_at to a date) lets PostgreSQL use an index on it.
 */
function bounds(range: MetricsRange) {
  return {
    start: sql`(${range.from}::date)::timestamp AT TIME ZONE 'UTC'`,
    end: sql`(${range.to}::date + 1)::timestamp AT TIME ZONE 'UTC'`,
  };
}

export const metricsRepository = {
  async summary(range: MetricsRange): Promise<SummaryRow> {
    const { start, end } = bounds(range);
    const { rows } = await sql<SummaryRow>`
      WITH scoped AS (
        SELECT status, priority, assignee_id, created_at, resolved_at
        FROM tickets
        WHERE created_at >= ${start} AND created_at < ${end}
      ),
      durations AS (
        SELECT *, EXTRACT(EPOCH FROM resolved_at - created_at) / 3600 AS resolution_hours
        FROM scoped
      )
      SELECT
        COUNT(*)                                                       AS "created",
        COUNT(*) FILTER (WHERE status = 'resolved')                    AS "resolved",
        COUNT(*) FILTER (WHERE assignee_id IS NULL AND status <> 'resolved') AS "unassigned",
        COUNT(*) FILTER (WHERE status = 'open')                        AS "statusOpen",
        COUNT(*) FILTER (WHERE status = 'in_progress')                 AS "statusInProgress",
        COUNT(*) FILTER (WHERE status = 'resolved')                    AS "statusResolved",
        COUNT(*) FILTER (WHERE priority = 'low')                       AS "priorityLow",
        COUNT(*) FILTER (WHERE priority = 'medium')                    AS "priorityMedium",
        COUNT(*) FILTER (WHERE priority = 'high')                      AS "priorityHigh",
        COUNT(*) FILTER (WHERE priority = 'urgent')                    AS "priorityUrgent",
        -- Unresolved tickets have a NULL duration, and both aggregates skip NULLs.
        ROUND(AVG(resolution_hours)::numeric, 1)::float8               AS "avgResolutionHours",
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY resolution_hours))::numeric, 1)::float8
                                                                       AS "medianResolutionHours"
      FROM durations
    `.execute(db);

    const [row] = rows;
    if (!row) throw new Error('Metrics summary query returned no row');
    return row;
  },

  /** Every agent (even with zero tickets), plus admins only if they have tickets assigned. */
  async perAgent(range: MetricsRange): Promise<AgentRow[]> {
    const { start, end } = bounds(range);
    const { rows } = await sql<AgentRow>`
      SELECT
        u.id,
        u.name,
        u.role,
        COUNT(t.id)                                          AS "assigned",
        COUNT(t.id) FILTER (WHERE t.status = 'in_progress')  AS "inProgress",
        COUNT(t.id) FILTER (WHERE t.status = 'resolved')     AS "resolved"
      FROM users u
      -- The date filter lives in the JOIN, not in WHERE: in WHERE it would drop agents with no tickets.
      LEFT JOIN tickets t
        ON t.assignee_id = u.id
       AND t.created_at >= ${start} AND t.created_at < ${end}
      WHERE u.role IN ('agent', 'admin')
      GROUP BY u.id
      HAVING u.role = 'agent' OR COUNT(t.id) > 0
      ORDER BY "assigned" DESC, u.name
    `.execute(db);
    return rows;
  },

  /** One row per day in the range, including days with zero tickets. */
  async openedPerDay(range: MetricsRange): Promise<DayRow[]> {
    // The series MUST be `timestamp` (no time zone). Given plain dates, GENERATE_SERIES returns
    // `timestamptz` in the session's time zone, and AT TIME ZONE 'UTC' then shifts every day:
    // tickets land on the wrong date. A test with the session in America/Bogota caught it.
    const { rows } = await sql<DayRow>`
      SELECT
        TO_CHAR(d.day, 'YYYY-MM-DD') AS "date",
        COUNT(t.id)                  AS "count"
      FROM GENERATE_SERIES(
        ${range.from}::date::timestamp,
        ${range.to}::date::timestamp,
        INTERVAL '1 day'
      ) AS d(day)
      LEFT JOIN tickets t
        ON t.created_at >= d.day AT TIME ZONE 'UTC'
       AND t.created_at <  (d.day + INTERVAL '1 day') AT TIME ZONE 'UTC'
      GROUP BY d.day
      ORDER BY d.day
    `.execute(db);
    return rows;
  },
};

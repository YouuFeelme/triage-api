# triage-api

[![CI](https://github.com/YouuFeelme/triage-api/actions/workflows/ci.yml/badge.svg)](https://github.com/YouuFeelme/triage-api/actions/workflows/ci.yml)

Backend for a support helpdesk: customers open tickets, agents work them, admins see metrics.
Built with debugging in mind — every request has a traceable ID and every error has a stable, documented shape.

**Stack:** TypeScript · Node.js · Express · PostgreSQL · Kysely · JWT · OpenAPI · Vitest · Docker · GitHub Actions · AWS

## Status

| Phase | What                                                           | State |
| ----- | -------------------------------------------------------------- | ----- |
| 1     | Design and OpenAPI contract                                    | ✅    |
| 2     | Project skeleton (strict TS, Express, ESLint/Prettier, layers) | ✅    |
| 3     | PostgreSQL in Docker + migrations                              | ✅    |
| 4     | Auth: register, login, JWT + refresh rotation, roles           | ✅    |
| 5     | Tickets, status workflow, filters, pagination, metrics         | ✅    |
| 6     | Unit + integration tests (≥ 80% coverage)                      | ✅    |
| 7     | Multi-stage Dockerfile, docker-compose, CI on every PR         | ✅    |
| 8     | Deploy to AWS, public Swagger UI                               | ⏳    |

## Getting started

Requires Node.js 24 (see `.nvmrc`) and Docker.

```bash
npm install
cp .env.example .env
npm run db:up        # PostgreSQL 17 in Docker
npm run db:migrate   # create the tables
npm run db:seed      # sample users, tickets and comments
npm run dev
```

```bash
curl -i http://localhost:3000/api/v1/health         # liveness: is the process up?
curl -i http://localhost:3000/api/v1/health/ready   # readiness: can it reach the database?
```

Every response includes an `X-Request-Id` header. Send your own (`-H "X-Request-Id: my-id"`) and it will show up in the server logs, so you can trace a single request end to end.

More example requests live in [`http/`](http/) (open them with the VS Code REST Client extension).

## Database

PostgreSQL runs in Docker (`docker-compose.yml`) with two databases: `triage` for development and `triage_test` for integration tests.
Queries go through [Kysely](https://kysely.dev), a type-safe SQL query builder: TypeScript checks every column name and type, and plain SQL is still one `sql` tag away when it's clearer.

- **Schema types:** [`src/db/schema.ts`](src/db/schema.ts) (camelCase in TypeScript, snake_case in PostgreSQL).
- **Migrations:** [`src/db/migrations/`](src/db/migrations/). Applied ones are recorded in the `kysely_migration` table. Never edit a migration that's been pushed; add a new one.
- **Integrity lives in the database too:** enums for roles and statuses, `CHECK` constraints (lowercase emails, title length, `resolved_at` set if and only if the ticket is resolved), foreign keys with explicit `ON DELETE` rules, and a trigger that keeps `updated_at` current.

Seed users all share the password `Password123!`:

| Email                | Role     |
| -------------------- | -------- |
| `admin@triage.dev`   | admin    |
| `lucia@triage.dev`   | agent    |
| `mateo@triage.dev`   | agent    |
| `ana@example.com`    | customer |
| `carlos@example.com` | customer |
| `sofia@example.com`  | customer |

## Authentication

| Token   | What it is                            | Lifetime | Stored server-side             |
| ------- | ------------------------------------- | -------- | ------------------------------ |
| Access  | JWT (HS256) with the user id and role | 15 min   | No, it's verified by signature |
| Refresh | 256 random bits, opaque to the client | 7 days   | Only its SHA-256 hash          |

- Send the access token as `Authorization: Bearer <token>`. An expired one returns `401 TOKEN_EXPIRED` (refresh and retry); anything else wrong returns `401 UNAUTHENTICATED` (log in again).
- **Rotation:** every `POST /auth/refresh` revokes the token it receives and returns a new pair. Concurrent refreshes are serialized with `SELECT ... FOR UPDATE`.
- **Reuse detection:** all tokens from one login share a `family_id`. If an already-used token comes back, someone has a copy, so the whole family is revoked and a warning is logged.
- **Login hardening:** unknown email and wrong password return the same `401 INVALID_CREDENTIALS` and take the same time (a dummy bcrypt comparison runs for unknown emails). After 10 failed attempts in 15 minutes, an IP gets `429` with `Retry-After`.
- **Roles** are checked per route with `requireRole('admin')`. Because access tokens are stateless, a role change applies when the user's next access token is issued (at most 15 minutes).

Try the whole flow with [`http/auth.http`](http/auth.http).

## Tickets

| Rule                      | Where it lives                                                             |
| ------------------------- | -------------------------------------------------------------------------- |
| Who can call an endpoint  | Route: `requireRole('admin')`, `requireRole('agent', 'admin')`             |
| Which tickets you can see | Service: customers only see their own; anyone else's is a `404`            |
| Status changes            | Service: a transition table (`open → in_progress → resolved → open`)       |
| Data integrity            | Database: enums, `CHECK (status = 'resolved') = (resolved_at IS NOT NULL)` |

- **Status changes** run in a transaction with `SELECT ... FOR UPDATE`, so two agents moving the same ticket are applied one after the other. Invalid transitions return `409`; starting work on an unassigned ticket assigns it to the caller.
- **Lists** support `status` and `priority` (comma-separated), `assigneeId` (`me`, `none` or a UUID), `q` (title search, `%` and `_` escaped), `sort` and `page`/`limit`. One extra query loads all customer and assignee names for the page, never one per ticket.
- **Comments:** customers see and write public replies on their own tickets; agents and admins also see and write internal notes.
- **Metrics** (`GET /metrics/summary`, admin) are hand-written SQL in [`metrics.repository.ts`](src/repositories/metrics.repository.ts): `COUNT(*) FILTER`, `PERCENTILE_CONT` for the median resolution time, a `LEFT JOIN` that keeps agents with no tickets, and `GENERATE_SERIES` so days without tickets still appear. Days are UTC calendar days regardless of the database session's time zone.

Try the whole flow with [`http/tickets.http`](http/tickets.http).

## Testing

```bash
npm run db:up          # the tests use the triage_test database in the same container
npm test               # unit + integration tests
npm run test:coverage  # same, with a coverage report (fails under 80%)
```

- **Unit tests** (`tests/unit/`) cover pure logic: tokens, validation, error formatting, date ranges.
- **Integration tests** (`tests/integration/`) call the real Express app through [Supertest](https://github.com/ladjs/supertest) and hit a real PostgreSQL database, so SQL, constraints and transactions are tested too. Every test starts from empty tables.
- **Isolation from your data:** tests never read `.env`; they always point at `triage_test`, and the reset helper refuses to truncate any database whose name doesn't end in `_test`.
- **Why Vitest instead of Jest:** `jose` 6 and Kysely 0.29 ship only as ES modules. Jest's CommonJS module loader can't load them without transpiling `node_modules`, and `jose` fails inside Jest's sandbox. Vitest runs them natively with the same `describe`/`it`/`expect` API.

## Docker

The production image is built in stages: one compiles TypeScript with every dependency, the final one keeps only `dist/` and runtime dependencies on `node:24-alpine`, runs as the unprivileged `node` user and has a health check.

```bash
npm run docker:up     # PostgreSQL + migrations + the API, built from the Dockerfile
curl -i http://localhost:8080/api/v1/health/ready
npm run docker:logs   # JSON logs from the container
npm run docker:down
```

- The containerized API listens on **8080** so it can run next to `npm run dev` (3000). Both use the same `triage` database.
- Migrations run as a one-shot `migrate` service; the API only starts once they've succeeded.
- `JWT_SECRET` comes from your `.env`; Compose refuses to start without it.

## Continuous integration

[GitHub Actions](.github/workflows/ci.yml) runs on every pull request and every push to `main`:

1. `npm ci` (exactly what `package-lock.json` says)
2. `npm run check`: types, ESLint, Prettier, OpenAPI contract
3. `npm run test:coverage` against a PostgreSQL service container (fails under 80%)
4. `npm run build`
5. Builds the Docker image

## Scripts

| Command                 | What it does                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run dev`           | Starts the API with hot reload and readable logs                       |
| `npm run build`         | Compiles TypeScript to `dist/`                                         |
| `npm start`             | Runs the compiled build                                                |
| `npm run db:up`         | Starts PostgreSQL in Docker and waits until it's healthy               |
| `npm run db:down`       | Stops PostgreSQL (data is kept in a Docker volume)                     |
| `npm run db:migrate`    | Applies pending migrations                                             |
| `npm run db:rollback`   | Undoes the last migration                                              |
| `npm run db:seed`       | Replaces all data with sample data (never in production)               |
| `npm run db:reset`      | Rolls everything back, migrates and seeds again                        |
| `npm run db:psql`       | Opens a `psql` shell inside the database container                     |
| `npm run docker:up`     | Builds the image and starts PostgreSQL + migrations + API on port 8080 |
| `npm run docker:logs`   | Follows the API container's logs                                       |
| `npm run docker:down`   | Stops every container (data is kept)                                   |
| `npm run typecheck`     | Type-checks without emitting files                                     |
| `npm run lint`          | ESLint with type-aware rules                                           |
| `npm run format`        | Formats everything with Prettier                                       |
| `npm run lint:api`      | Validates `openapi.yaml` with Redocly                                  |
| `npm test`              | Runs unit and integration tests                                        |
| `npm run test:watch`    | Re-runs tests on every file change                                     |
| `npm run test:coverage` | Tests + coverage report (minimum 80%)                                  |
| `npm run check`         | All of the above checks, the same ones CI will run                     |

## Project structure

```
src/
├── app.ts              # Builds the Express app (no listen, so tests can import it)
├── server.ts           # Starts the HTTP server, graceful shutdown
├── config/             # Validated environment variables, app info
├── db/                 # Kysely connection, schema types, migrations, seed
├── lib/                # Shared infrastructure (logger, passwords, tokens, validation)
├── errors/             # AppError + RFC 9457 Problem Details
├── middlewares/        # Request ID, logging, auth + roles, rate limit, 404, error handler
├── routes/             # URL → controller mapping, one file per resource
├── schemas/            # Zod schemas for request bodies, queries and params
├── controllers/        # HTTP in/out: read the request, call a service, send the response
├── services/           # Business rules (status transitions, permissions...)
└── repositories/       # Data access: the only layer that talks to PostgreSQL
tests/
├── setup/              # Test environment, test DB migration, per-file hooks
├── helpers/            # Supertest client, user/ticket factories, DB reset
├── unit/               # Pure logic, no database
└── integration/        # Real HTTP requests against a real database
```

A request flows `route → controller → service → repository`, and each layer only calls the one below it.
Errors travel the other way: any layer throws an `AppError`, and the error handler turns it into a response.

## Docs

- [`docs/design.md`](docs/design.md) — entities, ticket lifecycle, permissions, error format and the reasoning behind them.
- [`openapi.yaml`](openapi.yaml) — the API contract (OpenAPI 3.1). It was written before the code and is the source of truth.

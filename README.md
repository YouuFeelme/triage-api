# triage-api

Backend for a support helpdesk: customers open tickets, agents work them, admins see metrics.
Built with debugging in mind — every request has a traceable ID and every error has a stable, documented shape.

**Stack:** TypeScript · Node.js · Express · PostgreSQL · JWT · OpenAPI · Jest · Docker · GitHub Actions · AWS

## Status

| Phase | What                                                           | State |
| ----- | -------------------------------------------------------------- | ----- |
| 1     | Design and OpenAPI contract                                    | ✅    |
| 2     | Project skeleton (strict TS, Express, ESLint/Prettier, layers) | ✅    |
| 3     | PostgreSQL in Docker + migrations                              | ✅    |
| 4     | Auth: register, login, JWT + refresh rotation, roles           | ⏳    |
| 5     | Tickets, status workflow, filters, pagination, metrics         | ⏳    |
| 6     | Unit + integration tests (≥ 80% coverage)                      | ⏳    |
| 7     | Multi-stage Dockerfile, docker-compose, CI on every PR         | ⏳    |
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

## Scripts

| Command               | What it does                                             |
| --------------------- | -------------------------------------------------------- |
| `npm run dev`         | Starts the API with hot reload and readable logs         |
| `npm run build`       | Compiles TypeScript to `dist/`                           |
| `npm start`           | Runs the compiled build                                  |
| `npm run db:up`       | Starts PostgreSQL in Docker and waits until it's healthy |
| `npm run db:down`     | Stops PostgreSQL (data is kept in a Docker volume)       |
| `npm run db:migrate`  | Applies pending migrations                               |
| `npm run db:rollback` | Undoes the last migration                                |
| `npm run db:seed`     | Replaces all data with sample data (never in production) |
| `npm run db:reset`    | Rolls everything back, migrates and seeds again          |
| `npm run db:psql`     | Opens a `psql` shell inside the database container       |
| `npm run typecheck`   | Type-checks without emitting files                       |
| `npm run lint`        | ESLint with type-aware rules                             |
| `npm run format`      | Formats everything with Prettier                         |
| `npm run lint:api`    | Validates `openapi.yaml` with Redocly                    |
| `npm run check`       | All of the above checks, the same ones CI will run       |

## Project structure

```
src/
├── app.ts              # Builds the Express app (no listen, so tests can import it)
├── server.ts           # Starts the HTTP server, graceful shutdown
├── config/             # Validated environment variables, app info
├── db/                 # Kysely connection, schema types, migrations, seed
├── lib/                # Shared infrastructure (logger, password hashing, timeouts)
├── errors/             # AppError + RFC 9457 Problem Details
├── middlewares/        # Request ID, request logging, 404, error handler
├── routes/             # URL → controller mapping, one file per resource
├── controllers/        # HTTP in/out: read the request, call a service, send the response
├── services/           # Business rules (status transitions, permissions...)
└── repositories/       # Data access: the only layer that talks to PostgreSQL
```

A request flows `route → controller → service → repository`, and each layer only calls the one below it.
Errors travel the other way: any layer throws an `AppError`, and the error handler turns it into a response.

## Docs

- [`docs/design.md`](docs/design.md) — entities, ticket lifecycle, permissions, error format and the reasoning behind them.
- [`openapi.yaml`](openapi.yaml) — the API contract (OpenAPI 3.1). It was written before the code and is the source of truth.

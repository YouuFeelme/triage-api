# triage-api

Backend for a support helpdesk: customers open tickets, agents work them, admins see metrics.
Built with debugging in mind — every request has a traceable ID and every error has a stable, documented shape.

**Stack:** TypeScript · Node.js · Express · PostgreSQL · JWT · OpenAPI · Jest · Docker · GitHub Actions · AWS

## Status

| Phase | What | State |
|-------|------|-------|
| 1 | Design and OpenAPI contract | ✅ |
| 2 | Project skeleton (strict TS, Express, ESLint/Prettier, layers) | ⏳ |
| 3 | PostgreSQL in Docker + migrations | ⏳ |
| 4 | Auth: register, login, JWT + refresh rotation, roles | ⏳ |
| 5 | Tickets, status workflow, filters, pagination, metrics | ⏳ |
| 6 | Unit + integration tests (≥ 80% coverage) | ⏳ |
| 7 | Multi-stage Dockerfile, docker-compose, CI on every PR | ⏳ |
| 8 | Deploy to AWS, public Swagger UI | ⏳ |

## Docs

- [`docs/design.md`](docs/design.md) — entities, ticket lifecycle, permissions, error format and the reasoning behind them.
- [`openapi.yaml`](openapi.yaml) — the API contract (OpenAPI 3.1). It was written before the code and is the source of truth.

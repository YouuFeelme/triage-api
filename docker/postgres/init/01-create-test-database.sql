-- Runs once, when the Postgres volume is first created.
-- A separate database for integration tests (phase 6), so tests can wipe data freely
-- without touching what you use in development.
CREATE DATABASE triage_test OWNER triage;

# Session 04 — Indexer: Scaffolding & DB Schema

## Summary

- Added `better-sqlite3`-backed persistence with migrations for `attestations_latest`, `issuers`, and `qr_challenges` tables.
- Implemented a viem-based listener that decodes Cubid attestation payloads and applies latest-wins semantics.
- Bootstrapped the Express API with Pino logging, automatic migrations, and listener lifecycle wiring.
- Created Vitest suites covering database upserts/deletions and attestation ingestion helpers.

## Tests

- `pnpm --filter indexer test`

## Follow-ups

- Flesh out route handlers (`/attest`, `/profile`, `/psi`, `/qr`) to use the new database layer.
- Add caching, rate limiting, and overlap computation (Session 05 scope).
- Expose health diagnostics for listener catch-up and DB status.

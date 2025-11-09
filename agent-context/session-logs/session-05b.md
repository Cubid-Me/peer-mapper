# Session 05B — Supabase Auth & Profile Store

## Summary

- Integrated Supabase JS client in both frontend and indexer, created reusable admin helper, and enforced JWT auth for QR routes.
- Added minimal `public.users` migration with triggers and RLS policies; updated env templates for Supabase URLs, anon/service keys, and JWT secret.
- Built Zustand-powered `useUserStore`, AuthProvider listener, and sign-in flow that issues magic links, updates profiles, and links wallets while surfacing session state in a new header.
- Documented Supabase-driven behaviour across technical and functional specs, refreshed API draft, and logged the session.

## Tests

- `pnpm --filter frontend test`
- `pnpm --filter indexer test`
- `pnpm lint`
- `pnpm --filter frontend build`
- `pnpm --filter indexer build`

## Follow-ups

- Implement secure Cubid SDK handshake to automatically fetch verified Cubid IDs post Supabase login.
- Extend indexer profile routes to expose authenticated user details and write paths guarded by Supabase roles.
- Add end-to-end coverage for the Supabase-authenticated QR flow once Supabase environment values are wired in CI.

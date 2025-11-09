Thisi document is a 10+ session, soup-to-nuts implementation plan for an AI Coding Agent. Each session is a self-contained sprint with precise tasks, files to create, commands to run, tests to write, and a session log + docs update in `agent-context/`. The agent operates in VS Code with only `agent-context/technical-spec.md` provided at start.

---

Current state: Session 1 completed (monorepo scaffolded).
Next action: Start session 6, rows 694++

---

## Directory Map (target state)

```
/contracts
  /lib/eas
  /lib/openzeppelin
  /src/FeeGate.sol
  /script/{DeployEAS.s.sol,RegisterSchema.s.sol,DeployFeeGate.s.sol}
  /test/{EASDeploy.t.sol,SchemaReg.t.sol,FeeGate.t.sol}
  foundry.toml

/indexer
  schema.sql
  tsconfig.json
  src/{api.ts,listener.ts,db.ts,env.ts}
  src/routes/{attest.ts,profile.ts,qr.ts,psi.ts}
  src/services/{overlap.ts,typedData.ts}
  tests/*.test.ts
  Dockerfile

/frontend
  next.config.js
  postcss.config.js
  tailwind.config.js
  app/(routes)/{signin,circle,vouch,scan,results}/page.tsx
  lib/{cubid.ts,api.ts,eip712.ts,wallet.ts}
  components/{QRDisplay.tsx,QRScanner.tsx,Badge.tsx,...}
  __tests__/*.test.tsx

/agent-context
  technical-spec.md
  api.md
  eas-addresses.md
  runbook.md
  demo-script.md
  /session-logs/session-0X.md
```

---

# Session 1 — Bootstrap the Monorepo & Tooling

## Goals

- Create a clean monorepo scaffold.
- Install & pin core tooling.
- Vendor EAS contracts (SchemaRegistry + EAS).
- Establish conventions: TypeScript, linting, testing, commit hooks.
- Seed env templates and base docs.
- Align agents.md and this instruction file

## Tasks

1. **Repo & workspace**

- Initialize git repo.
- Create workspaces:
  - `contracts/` (Foundry)
  - `indexer/` (Node/TS + Express)
  - `frontend/` (Next.js + TS + Tailwind)
  - `agent-context/` (docs + logs)

- Add root `.editorconfig`, `.gitignore`.

2. **Tool pinning**

- Install Node LTS (via `fnm`/`asdf`), pnpm.
- Install Foundry (`foundryup`).
- Add `./tool-versions.md` capturing exact versions.

3. **EAS contracts**

- Create `contracts/lib/eas/` as a git submodule (or shallow copy) of EAS core:
  - `SchemaRegistry.sol`, `EAS.sol`, interfaces, and required libs.

- Add a `contracts/lib/openzeppelin/` (submodule).

4. **Configs & quality**

- Root ESLint/Prettier configs for TS + Solidity lint (solhint).
- Husky + lint-staged to format/lint on commit.
- Add `LICENSE` (MIT).

5. **Environment templates**

- Create `.env.example` files:
  - root: `MOONBEAM_RPC`, `PRIVATE_KEY_RELAYER`
  - `indexer/`: `DATABASE_URL`, `REGISTRY_ADDR`, `EAS_ADDR`, `SCHEMA_UID`, `FEEGATE_ADDR`, rate limits
  - `frontend/`: `NEXT_PUBLIC_EAS_ADDR`, `NEXT_PUBLIC_FEEGATE_ADDR`, `NEXT_PUBLIC_SCHEMA_UID`, `NEXT_PUBLIC_INDEXER_URL`, `NEXT_PUBLIC_CHAIN_ID=1284`

6. **Docs**

- Update `agent-context/technical-spec.md` (provided).
- Create `agent-context/api-draft.md` (empty stub).
- Create `agent-context/session-logs/session-01.md` (to be filled at end).
- Update `README.md` (provided)
- Align `AGENTS.md` with this file, removing any discrepancies

## Commands (example)

```bash
git init
pnpm -v                         # ensure installed
foundryup                       # install Foundry
mkdir -p contracts/{lib,src,test,script} indexer frontend agent-context/session-logs
pnpm dlx husky-init && pnpm i
pnpm add -D eslint prettier lint-staged @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## Tests

- None executable yet; just run `pnpm -w lint` to confirm setup integrity.

## Acceptance Criteria

- Repo compiles linting.
- EAS submodule present.
- `.env.example` files exist.
- Docs stubs exist.

## Deliverables

- Monorepo skeleton with tooling pinned.
- Session log.

---

# Session 2 — Contracts: Deploy EAS Core & Define Trust Schema

## Goals

- Prepare Foundry project.
- Include EAS contracts.
- Create deploy scripts for `SchemaRegistry` & `EAS`.
- Register `CubidTrust` schema.

## Tasks

1. **Foundry config**

- `contracts/foundry.toml` with compiler `0.8.24`.
- Add `script/DeployEAS.s.sol` to deploy SchemaRegistry + EAS.
- Add `script/RegisterSchema.s.sol` to register schema fields:

  ```
  string cubidId; uint8 trustLevel; bool human; bytes32 circle; uint64 issuedAt; uint64 expiry; uint256 nonce;
  ```

2. **Chain config**

- `.env` values for Moonbeam RPC + deployer key (provision empty by default).
- Hardcode `chainId 1284` in docs, not in code.

3. **Unit tests**

- `test/EASDeploy.t.sol`: smoke test deployment in Foundry (local anvil).
- `test/SchemaReg.t.sol`: schema registration success, revert on duplicate.

4. **Docs**

- Update `agent-context/technical-spec.md` with deployed addresses placeholders.
- `agent-context/eas-addresses.md`: to record addresses post-deploy.

## Commands

```bash
cd contracts
forge fmt && forge build
forge test
# when ready to deploy:
forge script script/DeployEAS.s.sol --rpc-url $MOONBEAM_RPC --broadcast --verify
forge script script/RegisterSchema.s.sol --rpc-url $MOONBEAM_RPC --broadcast
```

## Acceptance Criteria

- Deployed `SchemaRegistry` and `EAS` to Moonbeam **(or prepared to deploy)**.
- Schema registered; `SCHEMA_UID` recorded.

## Deliverables

- Deployed addresses (or local anvil dry-run artifacts).
- Session log with addresses.

---

# Session 3 — Contracts: Implement FeeGate Resolver (Nonce + Lifetime Fee)

## Goals

- Implement `FeeGate.sol` as EAS resolver with:
  - Per-issuer nonce check (for delegated attestations).
  - One-time 100 GLMR fee on the **3rd** attestation per issuer.
  - Optional last-UID anchor for latest-wins determinism.

## Tasks

1. **Contract**

- `contracts/src/FeeGate.sol`:
  - Immutable pointers to `EAS`, `SCHEMA_UID`.
  - `attestCount`, `lifetimeFeePaid`, `issuerNonce` mappings.
  - `attestDelegated(Attestation, sig, deadline)` path verifying EIP-712 digest.
  - `attestDirect(...)` path (issuer calls directly); nonce check optional (rely on EVM nonce).
  - Transfer GLMR to contract on 3rd attn if not paid.
  - Emit `FeeCharged(issuer, amount, count)`.

2. **EIP-712 domain**

- Domain(name=`FeeGate`, version=`1`, chainId=1284, verifyingContract=FeeGate).

3. **Unit tests**

- `test/FeeGate.t.sol`:
  - Delegated: correct nonce → success; wrong nonce → revert.
  - Deadline expired → revert.
  - 1st & 2nd attns no fee; 3rd requires exact `100 ether`.
  - Direct path works without delegated nonce.
  - lastUID anchoring (if implemented).

4. **Script**

- `script/DeployFeeGate.s.sol` to deploy and set as schema resolver (if EAS requires linking).
- Update `eas-addresses.md`.

## Acceptance Criteria

- Tests pass locally (anvil).
- Deployment script ready.

## Deliverables

- Verified `FeeGate.sol` build & tests.
- Session log.

---

# Session 4 — Indexer: Scaffolding & DB Schema

## Goals

- Create Node/TS indexer with Express.
- Create DB schema & migration script.
- Wire minimal chain listener for EAS `Attested`/`Revoked`.

## Tasks

1. **Project init**

- `indexer/tsconfig.json`, `package.json`, `src/{listener.ts,api.ts,db.ts,env.ts}`, `src/routes/*.ts`.
- Dependencies: `viem`, `zod`, `express`, `pino`, `better-sqlite3` or `pg`, `rate-limiter-flexible`, `dayjs`, `lru-cache`, `supertest`, `vitest`.

2. **DB schema**

- For SQLite (hackathon-friendly) create `schema.sql` with tables:
  - `attestations_latest(issuer TEXT, cubidId TEXT, trustLevel INT, human INT, circle BLOB, issuedAt INT, expiry INT, uid TEXT, blockTime INT, PRIMARY KEY(issuer, cubidId))`
  - `issuers(issuer TEXT PRIMARY KEY, attestCount INT, feePaid INT, expectedNonce INT)`
  - `qr_challenges(id TEXT PRIMARY KEY, issuedFor TEXT, expiresAt INT, used INT)`

3. **Listener**

- `src/listener.ts` subscribes to EAS `Attested` (filtered by `SCHEMA_UID`) and optional `Revoked`.
- Parse and upsert `attestations_latest` (apply latest-wins by blockTime/UID).

4. **Server**

- `src/api.ts` bootstrap Express, mount health route.
- Configure logging & error middleware.

5. **Tests**

- `tests/db.test.ts`: migrations run, upserts work.
- `tests/listener.test.ts`: mock events processed.

## Commands

```bash
cd indexer
pnpm i
pnpm run dev # boots listener + api
pnpm test
```

## Acceptance Criteria

- Indexer runs locally against mocked provider.
- Tables created; insert/upsert logic verified.

## Deliverables

- Running indexer skeleton.
- Session log.

---

# Session 5 — Indexer: Business Logic (PSI-lite, Rate Limits, QR Challenges)

## Goals

- Implement overlap computation per policy (asymmetric allowed).
- Add rate limiting & 120-second caching.
- Add QR challenge lifecycle.

## Tasks

1. **Overlap service**

- `src/services/overlap.ts`: For A viewing B:
  - Get inbound attestations for B.
  - Intersect with A’s known/trusted issuers (from A’s inbound/outbound—or restrict to inbound for MVP).
  - Filter by non-expired (`expiry == 0 || now <= expiry`).
  - Return issuer, trustLevel, circle, freshness.

2. **Rate limiting & caching**

- `src/mw/rateLimit.ts` per IP: 2 req/s, 100/day.
- Use LRU cache keyed by `aCubidId|bCubidId` for 120s.

3. **QR challenges**

- `GET /qr/challenge` → issue `{ challengeId, challenge, expiresAt }` (90s).
- `POST /qr/verify` → require both parties sign `challenge` with their EVM wallets; verify sigs; mark used; proceed to overlap.

4. **Tests**

- `tests/overlap.test.ts`: simulated datasets, asymmetric outputs.
- `tests/qr.test.ts`: issue, verify, replay prevention.

## Acceptance Criteria

- Overlap API returns correct issuers & metadata with rate limits enforced.
- QR replay blocked after first use or expiry.

## Deliverables

- Completed services & tests.
- Session log.

---

# Session 5B — Add Supabase Auth and Minimal State Management

## Goal

Introduce **Supabase Auth** (for app sessions) and a lightweight **user profile** store (name & photo) without replacing Cubid as the identity backbone. Everyone is a “**user**” (can both vouch and be vouched for). Frontend gets a clean, persistent session; backend gains durable, RLS-protected user rows.

**Outcome:**

- Users sign in (Supabase session) → app fetches/sets their **Cubid-ID**, **name**, **photo**, and **EVM address**.
- Indexer/API can safely associate calls with an authenticated `user_id`.
- Frontend has a tiny global store for `session | user | wallet`.

---

## Prereqs

- Session 5A (Supabase Enablement) complete.
- Supabase project linked (`supabase link …`) and CLI logged in.
- Frontend and Indexer already running locally.

Use SUPABASE_ACCESS_TOKEN from .env.local to update supabase.

---

## Tasks

### 1) Add Supabase JS to frontend & server

```bash
# frontend
pnpm -w add @supabase/supabase-js
# indexer (only if you’ll validate JWTs server-side for protected endpoints)
pnpm --filter indexer add @supabase/supabase-js jsonwebtoken
```

Create clients:

- **frontend/lib/supabaseClient.ts**

```ts
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } },
);
```

- **indexer/src/auth/supabase.ts** (optional, if validating JWTs)

```ts
import { createClient } from '@supabase/supabase-js';
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
```

Add envs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Update `.env.example` files accordingly.

---

### 2) Database: users table, RLS, and supporting views

Create migration:

```bash
supabase migration new add_users_profile_minimal
```

Edit `supabase/migrations/<ts>_add_users_profile_minimal.sql`:

```sql
-- Core users profile (one row per auth user)
create table if not exists public.users (
  user_id uuid primary key,           -- equals auth.users.id
  cubid_id text unique,               -- app-scoped Cubid identifier
  evm_address text unique,            -- optional: last linked EVM addr
  display_name text,                  -- minimal user-provided name
  photo_url text,                     -- minimal avatar/photo
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- RLS
alter table public.users enable row level security;

-- Authenticated user can read/update only self
create policy "users_self_select"
on public.users for select
to authenticated
using (user_id = auth.uid());

create policy "users_self_upsert"
on public.users for insert
to authenticated
with check (user_id = auth.uid());

create policy "users_self_update"
on public.users for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Service role full access (indexer / admin ops)
grant all on table public.users to service_role;
```

Apply:

```bash
supabase db push
```

> Note: we do **not** store email/phone; Cubid remains the identity provider for PII. Supabase Auth holds sessions; `public.users` is a pseudonymous profile keyed by `auth.users.id`.

---

### 3) Frontend: auth flows + minimal profile UI

**(a) Auth utilities**

- **frontend/lib/auth.ts**

```ts
import { supabase } from './supabaseClient';

export async function signInWithOtp(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export function onAuthStateChange(cb: Function) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
```

**(b) Minimal state store** (Zustand or React Context; choose one)

- **frontend/lib/store.ts** (Zustand example)

```ts
import { create } from 'zustand';
type UserState = {
  session: any | null;
  user: {
    user_id: string;
    cubid_id?: string;
    display_name?: string;
    photo_url?: string;
    evm_address?: string;
  } | null;
  setSession: (s: any | null) => void;
  setUser: (u: any | null) => void;
};
export const useUserStore = create<UserState>((set) => ({
  session: null,
  user: null,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
}));
```

**(c) Profile service**

- **frontend/lib/profile.ts**

```ts
import { supabase } from './supabaseClient';

export async function upsertMyProfile(p: {
  cubid_id?: string;
  display_name?: string;
  photo_url?: string;
  evm_address?: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No session');
  const { data, error } = await supabase
    .from('users')
    .upsert({ user_id: user.id, ...p }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMyProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('users').select('*').eq('user_id', user.id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}
```

**(d) Sign-In page adjustments**

- Let user enter email → `signInWithOtp(email)`; after callback, detect session; then:
  - Call Cubid SDK flow to obtain **Cubid-ID**.
  - Call `upsertMyProfile({ cubid_id, display_name, photo_url })`.
  - Prompt wallet connect; on connect, store `evm_address` via `upsertMyProfile`.

**(e) Header UI**

- Show user avatar (photo_url), display_name, short EVM address, and cubid_id.

---

### 4) Indexer: (optional) user awareness & JWT validation

If you want protected endpoints (e.g., QR issue/verify) to require Supabase Auth:

- Add middleware **indexer/src/mw/requireAuth.ts**

```ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    // Supabase JWTs are signed; you can validate with the project JWT secret if desired.
    // For hackathon: accept presence & decode only (best-effort).
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.sub) return res.status(401).json({ error: 'invalid token' });
    (req as any).user_id = decoded.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}
```

- Apply `requireAuth` to:
  - `POST /qr/verify`
  - `POST /attest/prepare`
  - `POST /attest/relay`

> This ties API usage to a real Supabase session, while on-chain attestations still use EVM signatures.

---

### 5) State wiring in pages

- On app mount: `getSession()` → `useUserStore.setSession(session)` → `fetchMyProfile()` → `setUser(profile)`.
- When wallet connects: update `evm_address` in profile; keep current address in local state too (for signing).
- When Cubid flow completes: ensure `cubid_id` is upserted.

---

### 6) Unit/Integration Tests

**Frontend (JSDOM + RTL):**

- `__tests__/auth.test.tsx`
  - Mocks Supabase auth client → verifies sign-in flow sets session.
  - After session, `fetchMyProfile` returns row (mocked).

- `__tests__/profile.test.ts`
  - `upsertMyProfile` inserts, then updates `display_name` & `photo_url`.

**Indexer (supertest):**

- `tests/requireAuth.test.ts`
  - Hitting a protected route without `Authorization` → 401.
  - With a mocked JWT → 200.

**SQL lint:**

```bash
supabase db lint
```

---

### 7) Docs & Session Log

- **agent-context/api.md**
  - Add note: protected routes accept `Authorization: Bearer <supabase_jwt>`.
  - Document `users` shape (public fields only).

- **agent-context/session-logs/session-05B.md**
  Include:
  - What changed (auth installed, users table + RLS, frontend state store).
  - SQL migration name & checksum.
  - Any new env vars.
  - Screenshots of Sign-In → Profile header.

---

## Acceptance Criteria

- Users can sign in with Supabase Auth and persist a **users** row (Cubid-ID, name, photo, EVM address).
- Protected endpoints reject unauthenticated calls.
- Frontend shows current user name/photo and connected wallet address.
- Tests for auth flow and profile upsert pass.

---

## Notes / Guardrails

- Keep **PII in Cubid**; Supabase holds only **display_name** and **photo_url** the user provides, plus Cubid-ID and wallet.
- RLS ensures users can only read/update their own row.
- Indexer shouldn’t require user PII—only `user_id` (from JWT) when necessary for protected actions (e.g., issuing QR challenges).

---

# Session 6 — Contracts & Indexer: Attestation Submission API (Prepare + Relay)

## Goals

- Implement `/attest/prepare` (typed data) and `/attest/relay` (send tx via FeeGate).
- Handle third-attestation fee path.
- Add OpenAPI draft.

## Tasks

1. **Prepare**

- Build EIP-712 typed data (domain: FeeGate v1) using `issuerNonce[issuer]` fetched from chain (via viem `readContract`) + `deadline = now + 5 min`.
- Response returns `domain`, `types`, `message`.

2. **Relay**

- Accept signature; compute GLMR `value` if issuer’s 3rd attestation & unpaid.
- Send transaction via relayer key to `FeeGate.attestDelegated`.
- On success, wait 1 confirmation; listener will ingest Attested.

3. **OpenAPI**

- Create `agent-context/api.md` with concise endpoint specs, request/response examples.

4. **Tests**

- `tests/submit.test.ts`: mock EIP-712, relay success/failure, fee condition.

## Acceptance Criteria

- End-to-end: prepare → wallet signs dummy → relay (anvil) → event processed.

## Deliverables

- Working attestation submission flow.
- Updated `api.md`.
- Session log.

---

# Session 7 — Frontend: Build All Required Pages (Next.js + Tailwind)

## Goals

- Implement MVP UI: Sign-In, My Circle, Vouch, Scan, Results.
- Integrate Cubid SDK (email sign-in to get `cubidId`).
- Integrate Nova/EVM wallet connection.
- Wire to indexer APIs.

## Tasks

1. **Scaffold**

- `frontend/` with Next.js (App Router or Pages per your preference; assume App Router).
- Tailwind CSS config.
- Shared UI components (`Badge`, `Button`, `Card`, `QRDisplay`, `QRScanner`).

2. **Auth & wallet**

- `lib/cubid.ts` for Cubid sign-in flow (mock if SDK not ready).
- Wallet connect (Nova/EVM) with `wagmi` or direct EIP-1193 provider; show connected address.

3. **Pages**

- `/signin`: email → OTP, redirect to /new-user or /circle
- `/new-user`: name → profile picture → connect wallet → fetch `cubidId` → store data in supabase public.users table.
- `/scan`: show my QR (`{ cubidId, ts }`), or scan partner’s QR → triggers QR challenge/verify → fetch results = partner's userId, name, photo (bidirectional, shows up for both users at same time). Redirect to /results
- `/results`: render overlaps list: issuer short addr, trust level, circle, freshness. Option to vouch, redirecting to /vouch
- `/vouch`: select `cubidId` (input), choose trust fields; call `/attest/prepare` → wallet signs → `/attest/relay`; handle 3rd fee UI.
- `/circle`: fetch inbound/outbound from `GET /profile/:cubidId`; render trust chips for all users I've vouched for before.
- `/profile': View / edit name & profile picture. View cubidId (read only). Can redirect to /scan.

4. **Tests**

- React Testing Library: basic renders; API mocks for success paths; QR component logic.

## Acceptance Criteria

- Full user flow works locally with indexer.
- Third-attestation fee path visibly handled.

## Deliverables

- Functional UI with basic styling.
- Session log with screenshots (optional).

---

# Session 8 — Polishing Security & Determinism

## Goals

- Enforce deadline validation in FeeGate delegated path.
- Implement optional last-UID anchor in FeeGate; indexer uses it if present.
- Add small DoS protections & error handling.

## Tasks

1. **FeeGate**

- Add `deadline` to typed struct; reject if expired.
- Add mapping `lastUID[issuer][cubidId]` set on each successful attestation callback (after EAS returns UID).
- Expose `getLastUID(address issuer, string cubidId)` view.

2. **Indexer**

- Prefer `lastUID` when available; otherwise fallback to latest by blockTime.
- Add exponential backoff on RPC errors.

3. **Tests**

- FeeGate: deadline expiry, lastUID correct.
- Indexer: conflict resolution uses lastUID deterministically.

## Acceptance Criteria

- Deterministic latest-wins proven in tests.
- Delegated signature cannot be replayed past deadline.

## Deliverables

- Hardened determinism path.
- Session log.

---

# Session 9 — Deployment & CI/CD

## Goals

- Real deployments to Moonbeam (EAS, FeeGate).
- Moonscan verification.
- Deploy indexer (Fly.io/Render/VM) + SQLite (or Postgres).
- Deploy frontend (Vercel).

## Tasks

1. **Contracts**

- Execute Foundry scripts for EAS + Schema + FeeGate.
- Record addresses in `agent-context/eas-addresses.md`, update envs.

2. **Moonscan**

- Verify contracts; store links.

3. **Indexer**

- Dockerfile + Health endpoints; deploy to a small instance; set envs securely; TLS.
- Logging to stdout; basic monitoring.

4. **Frontend**

- Vercel project; envs set; test base URLs.

5. **CI/CD**

- GitHub Actions:
  - Lint/test on PR.
  - Optionally manual deploy steps.

## Acceptance Criteria

- Public URLs for frontend + indexer.
- Contracts accessible & verified on Moonscan.

## Deliverables

- Addresses + URLs documented.
- Session log with links.

---

# Session 10 — Seed Data, Demo Script, and Final Docs

## Goals

- Seed a few real attestations (including the 3rd/fee path).
- Validate full QR handshake under realistic conditions.
- Finalize docs & runbook.

## Tasks

1. **Seeding**

- Create 3 demo issuers; perform 1–3 attestations each (trigger fee once).
- Create at least one shared trusted contact to demonstrate overlap.

2. **Demo script**

- `agent-context/demo-script.md`: step-by-step clickable guide:
  - Sign-in both users.
  - Vouch flows.
  - Scan QR, approve challenge, show overlaps.

3. **Docs & runbook**

- Update `agent-context/api.md` with final endpoints/examples.
- Add `agent-context/runbook.md` (how to restart indexer, rotate relayer key, change fee).
- Final `agent-context/session-logs/session-10.md`.

4. **Smoke tests**

- Frontend E2E happy path.
- Indexer rate limit hits & cache behavior.

## Acceptance Criteria

- Live demo works end-to-end twice in a row.
- All documents complete and discoverable.

## Deliverables

- Seeded state, demo-ready system.
- Final session log.

---

## Session Log Template (`agent-context/session-logs/session-XX.md`)

```
# Session XX — Title
## Goals
## Actions Performed
- …
## Commands & Outputs (highlights)
- …
## Artifacts
- files changed/created
- addresses/URLs recorded
## Tests
- summary & results
## Issues/Risks
- …
## Next Session Entry Criteria
- …
```

This plan gets you from blank repo to demo-ready in ~10 focused bursts, with built-in tests, deterministic behavior, and the EAS-first architecture on Moonbeam you wanted.

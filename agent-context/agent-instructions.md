Thisi document is a 10-session, soup-to-nuts implementation plan for an AI Coding Agent. Each session is a self-contained sprint with precise tasks, files to create, commands to run, tests to write, and a session log + docs update in `agent-context/`. The agent operates in VS Code with only `agent-context/technical-spec.md` provided at start.

---

Current state: Session 1 completed (monorepo scaffolded).
Next action: Start session 2, rows 135-216

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

- `/signin`: email → Cubid → store `cubidId`; connect wallet.
- `/circle`: fetch inbound/outbound from `GET /profile/:cubidId`; render trust chips.
- `/vouch`: select `cubidId` (input), choose trust fields; call `/attest/prepare` → wallet signs → `/attest/relay`; handle 3rd fee UI.
- `/scan`: show my QR (`{ cubidId, ts }`), or scan partner’s QR → triggers QR challenge/verify → fetch results.
- `/results`: render overlaps list: issuer short addr, trust level, circle, freshness.

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

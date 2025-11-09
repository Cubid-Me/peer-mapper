# Hackathon Spec: Privacy-Preserving “Known/Trusted” Verifier on Polkadot • Moonbeam

Below is a lean, end-to-end blueprint designed to build and ship in 1–2 days during a hackathon. It covers contracts, events, a tiny relayer/indexer, REST APIs, data schemas, and the minimal UI flow required to demo QR-based mutual-friend reveal using **Cubid app-scoped IDs** and **Moonbeam (EVM)**.

Peer-mapper is a lightweight nextjs app which allows people to establish trusted relationships, and view common friends who also trust each other. The aim in the hackathon is to build a crisp, demo-ready MVP flow with on-chain attestations, a relayed signature path, QR in-person handshake, and mutual-friend reveal—with privacy preserved via Cubid app-scoped IDs. Application sessions are backed by Supabase Auth so both the frontend and indexer can trust a shared, RLS-protected `public.users` profile table for minimal metadata (display name, photo, Cubid ID, wallet).

The implementation relies on **first deploying EAS** (Ethereum Attestation Service) and then building the app around it.

---

## Monorepo Bootstrap (Session 1)

- Workspaces: `contracts/` (Foundry 0.8.28, vendored `forge-std`, `eas-contracts`, `openzeppelin-contracts`), `indexer/` (Express + Vitest scaffold, DB + REST stubs, Dockerfile), `frontend/` (Next.js 15 + Tailwind v4 with route shells, shared libs, and UI atoms).
- Tooling pinned via `tool-versions.md`, Husky 9, lint-staged, ESLint 9, Prettier 3, Solhint 6.
- Env templates: root `.env.example` + workspace-specific `.env.example` files.
- Docs: this spec updated, new `api-draft.md`, `session-logs/session-01.md`.
- Commands: `pnpm lint`, `pnpm -r test`, `pnpm --filter <pkg> dev/build`.

# TrustNet on Moonbeam (Mainnet) using EAS

**Goal:** Public, replay-safe, spam-resistant attestations of “X trusts Y” where **Y is a Cubid-ID** (plain text), and “X” is an EVM address. In-person QR flow reveals mutual trusted overlaps. Cheap, clear, and hackathon-shippable.

**Stack**

- Chain: **Moonbeam mainnet** (chainId **1284**)
- Contracts: **EAS Core + SchemaRegistry** (your own fresh deployment), plus a minimal **FeeGate** wrapper
- Identity: **Cubid SDK** (email sign-in → app-scoped Cubid-ID)
- Wallets: **Nova** (EVM account), or any EVM wallet for web (Metamask, Talisman)
- Tooling: **Foundry**, Node/TS (Indexer + API), Next.js (Frontend)

---

## 1) On-chain Architecture

### 1.1 Deploy EAS

You will deploy **two contracts** to Moonbeam:

1. `SchemaRegistry`
2. `EAS` (the core attestation contract)

The Foundry scripts in `contracts/script/DeployEAS.s.sol` and `contracts/script/RegisterSchema.s.sol` handle this flow end to end. `DeployEAS` uses the `PRIVATE_KEY_DEPLOYER` signer to broadcast both deployments, while `RegisterSchema` registers the `CubidTrust` schema against an existing registry (resolver defaults to `address(0)` until the FeeGate lands in Session 3). Both scripts log the resulting addresses so they can be copied into `agent-context/eas-addresses.md` and `.env` placeholders.

> Rationale: Reusing a known standard gives you typed schemas, delegated (EIP-712) attestations, revocations, globally unique **UIDs**, and clean indexability.

### 1.2 Register the Trust Schema

Create one schema to encode your fields (typed and human-readable for wallets):

```
schema name:  "CubidTrust"
schema fields (EAS-encoded):
  string  cubidId
  uint8   trustLevel
  bool    human
  bytes32 circle
  uint64  issuedAt
  uint64  expiry   // 0 = evergreen
  uint256 nonce    // per-issuer replay guard
resolver: FeeGate (see 1.3)
revocable: true
```

This yields a **schemaUID** you’ll hardcode into the app, indexer, and FeeGate. Store the deployed contract addresses and schema UID in `agent-context/eas-addresses.md` for later sessions.

### 1.3 FeeGate (minimal wrapper + resolver)

Deploy a tiny **FeeGate** contract that:

- Implements the **EAS resolver** interface (so EAS calls it when an attestation is submitted).
- Enforces the **one-time lifetime fee** (100 GLMR) **on the 3rd attestation per issuer**.
- Enforces a **per-issuer nonce** for **delegated** attestations (meta-tx pattern).
- Optionally stores a **compact “last UID” anchor** for deterministic “latest wins” reads.
- Provides two submission paths: `attestDirect` (issuer wallet) and `attestDelegated` (relayed with EIP-712 signature validation).

**State**

```solidity
mapping(address => uint256) public attestCount;      // # attestations submitted by issuer
mapping(address => bool)    public lifetimeFeePaid;
mapping(address => uint256) public issuerNonce;      // expected next nonce for delegated sigs
mapping(address => mapping(bytes32 => bytes32)) private _lastUID; // keyed by keccak256(cubidId)
uint256 public constant LIFETIME_FEE = 100 ether;    // 100 GLMR
address public immutable EAS;                        // EAS core
bytes32 public immutable SCHEMA_UID;                 // CubidTrust schema UID
```

**Flow (delegated attestation)**

- Wallet signs EIP-712 **typed data** including `nonce = issuerNonce[issuer]` and a short **deadline**.
- App relays to FeeGate → FeeGate verifies signature+nonce and checks fee condition:
  - If `attestCount[issuer] == 2 && !lifetimeFeePaid[issuer]`, require `msg.value == 100 GLMR`, then set `lifetimeFeePaid = true`.

- FeeGate increments `issuerNonce[issuer]`, `attestCount[issuer]++`, and calls **`EAS.attest`** with the schema + encoded payload.
- Optionally, FeeGate caches `lastUID[issuer][cubidId] = uid` to anchor “latest wins”.

FeeGate exposes helper views (`domainSeparator()` + `hashAttestation(...)`) so the frontend can generate the delegated payload digest without reimplementing Solidity hashing.

**Direct (non-delegated) variant**

- If the issuer calls a FeeGate method directly with their wallet (no relayer), EVM **account nonce** protects against replay. You may **skip** the per-issuer nonce check for this path. (Keep it for delegated.)

**Events**

- Rely on **EAS’s `Attested(uid, schema, attester, …)`** event for indexing.
- Add one FeeGate event `FeeCharged(issuer, amount, atCount)` for transparency.

**Why this wrapper:** EAS gives you solid attestation plumbing; FeeGate adds your **payment rule** + **replay guard** in one place without reinventing EAS.

---

## 2) Data & Privacy Model

- **Subject:** `cubidId` is stored **in plain sight** (string). This is your explicit choice for clarity and simple indexing.
- **Issuer:** EVM address (Nova / EVM wallet).
- **Attestations are directional.**
- **Revocation:** set `trustLevel = NoOpinion` (or explicit EAS revoke) to neutralize a prior vouch.
- **Persona privacy:** Users may create multiple Cubid-IDs (personas). Untraceability is achieved by not reusing the same Cubid-ID across contexts.
- **Supabase session store:** Supabase Auth issues sessions. The `public.users` table mirrors Supabase `auth.users.id` in `user_id`, and stores optional `cubid_id`, `display_name`, `photo_url`, and `evm_address`. A trigger keeps `updated_at` current, and RLS policies (`users_self_select`, `users_self_upsert`, `users_self_update`) restrict profile access to the authenticated user while the service role retains full control for trusted backend jobs.

---

## 3) Indexer & API

### 3.1 Responsibilities

- Subscribe to **EAS.Attested** for your `SCHEMA_UID`, and **EAS.Revoked** (if used).
- Materialize a **latest view** per `(issuer, cubidId)` (using EAS UID timestamp/nonce or FeeGate `lastUID`).
- Serve PSI-lite overlap results for QR handshakes.
- Issue and validate **short-lived QR challenges** (anti-replay).
- Apply rate limits.
- Validate Supabase JWTs on QR/PSI endpoints using `SUPABASE_JWT_SECRET`, surfacing the authenticated `userId` to route handlers.

### 3.2 Storage (Postgres or SQLite)

- `attestations_latest(issuer, cubidId, trustLevel, human, circle, issuedAt, expiry, uid, blockTime)`
- `issuers(issuer, attestCount, feePaid, expectedNonce)`
- `qr_challenges(id, issuedFor, expiresAt, used)`

**Freshness:** `freshness = now - max(issuedAt, blockTime)`. Ignore attns with `expiry != 0 && now > expiry`.

**Session 04 implementation notes:** The indexer persists these tables via SQLite (`better-sqlite3`) migrations and enforces
latest-wins semantics by comparing `blockTime` first and, on ties, the attestation UID so reorgs cannot resurrect stale rows.
Revoked events delete cached rows by UID, keeping the view consistent with chain state.

### 3.3 REST Endpoints

- `POST /attest/prepare` → Returns EIP-712 typed data (domain: FeeGate) with `nonce` & `deadline`.
  - Pulls `issuerNonce`, `attestCount`, fee constants, and `hasPaidFee` directly from FeeGate via viem.
  - Deadline fixed at current UTC + 5 minutes; response includes fee metadata so the client can pre-fund the third attestation.
- `POST /attest/relay` → Relays signature + optional `value` (if it’s the 3rd attestation) to FeeGate.
  - Relayer uses `PRIVATE_KEY_RELAYER` to call `attestDelegated`, converts signature into `(v, r, s)`, and waits for one confirmation before responding.
- `GET /profile/:cubidId` → Inbound latest attestations for that Cubid-ID; optional `issuer=0x…` query returns outbound rows for the viewer wallet.
- `GET /qr/challenge` → `{ challengeId, challenge, expiresAt, issuedFor }` (valid ~90 s, stored in `qr_challenges`). Requires Supabase `Authorization: Bearer <access_token>`.
- `POST /qr/verify` → Party A & B each sign `challenge` (wallet sig), server verifies both with `viem.verifyMessage`, marks the challenge as used, returns sorted overlaps, then:
  - `POST /psi/intersection` (internal): compute overlaps with policy below.
- `POST /psi/intersection` → Internal helper guarded by the same Supabase auth middleware.

- **Rate-limits:** `RateLimiterMemory` enforces **2 req/s** and **100/day** per IP globally (429 on exceed).
- **Authentication:** When `SUPABASE_JWT_SECRET` is configured the middleware rejects missing/invalid tokens with `401` before hitting route logic.
- **Caching:** Intersection results cached for **120 s** per `(viewer|target)` pair via in-memory LRU to cut duplicate load.

### 3.4 Overlap Policy (asymmetric allowed)

- For **A viewing B**: show **issuers** who have a current attestation **about B**, and who are **in A’s trusted contacts** (A recognizes the named issuer). MVP implementation intersects inbound attestations only.
- Return: `issuer`, `trustLevel`, `circle`, `freshness`.
- `freshness = now - blockTime`, ignoring rows where `expiry != 0 && now > expiry`.

### 3.5 Chain listener skeleton (Session 04)

- `indexer/src/listener.ts` boots a `viem` watcher (when `MOONBEAM_RPC` is present) for EAS `Attested`/`Revoked`.
- Each attestation fetches `getAttestation(uid)`, decodes the Cubid payload with ABI helpers, and upserts the materialized
  view via the SQLite helper.
- Revocations drop rows when the UID matches, keeping the cache aligned with on-chain state.
- `indexer/src/api.ts` now wires Express, Pino logging, automatic migrations, and the listener lifecycle.

---

## 4) Frontend (Next.js)

### Architecture snapshot — Session 07

- **App Router** under `frontend/src/app` with shared layout + global styles.
- **Zustand stores**
  - `useUserStore` persists Supabase session, profile row, and the currently connected wallet.
  - `useScanStore` caches the latest QR verification payload so `/results` can render after navigation.
- **Shared UI** lives in `frontend/src/components/` (`Badge`, `QRDisplay`, `QRScanner`, `UserSessionSummary`).
- **API facade** in `frontend/src/lib/api.ts` wraps indexer endpoints (`/profile`, `/attest/prepare`, `/attest/relay`, `/qr/*`).
- **Wallet helpers** (`frontend/src/lib/wallet.ts`) wrap `window.ethereum` access, letting pages request accounts without duplicating logic.

### Route map & behaviour

| Route                | Purpose & implementation notes                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | Landing page (`app/page.tsx`) links to each flow in order.                                                                                                                                                                              |
| `/(routes)/signin`   | Magic-link entry (`signin/page.tsx`). Sends OTP via `signInWithOtp`, watches `useUserStore.session` and redirects to onboarding or circle.                                                                                              |
| `/(routes)/new-user` | Profile onboarding (`new-user/page.tsx`). Generates Cubid ID via `requestCubidId`, links wallets through `ensureWallet`, and upserts Supabase profile data.                                                                             |
| `/(routes)/profile`  | Profile maintenance (`profile/page.tsx`). Reads from `useUserStore`, lets users edit display name/photo, persists with `upsertMyProfile`.                                                                                               |
| `/(routes)/circle`   | Trust graph view (`circle/page.tsx`). Fetches inbound/outbound attestations via `getProfile`, formats freshness, and supports Cubid search.                                                                                             |
| `/(routes)/vouch`    | Delegated attestation flow (`vouch/page.tsx`). Validates inputs, calls `prepareAttestation`, signs typed data through `window.ethereum`, and relays via `/attest/relay`, surfacing lifetime-fee metadata.                               |
| `/(routes)/scan`     | QR handshake orchestrator (`scan/page.tsx`). Displays my QR payload (`QRDisplay`), parses peer payload, requests `/qr/challenge`, collects wallet signatures, and posts to `/qr/verify`. Stores the overlap response in `useScanStore`. |
| `/(routes)/results`  | Overlap renderer (`results/page.tsx`). Reads from `useScanStore`, shows badge cards for each shared issuer, and falls back to a helpful prompt when no data exists.                                                                     |

### Auth, Cubid & wallet integration

- `AuthProvider` boots Supabase session state and hydrates the profile before any route renders.
- Cubid flow is mocked via `requestCubidId(email)` but stored alongside Supabase user metadata so the indexer has a consistent `cubid_id`.
- `ensureWallet()` normalises Nova/EVM connection requests, storing the selected address in `useUserStore` so successive flows reuse it.
- Pages guard against missing session/profile data by redirecting to sign-in when required.

### QR security guardrails

- A challenge is only usable once: `/scan` insists on fetching `/qr/challenge` with the viewer’s Supabase token, both parties sign via `personal_sign`, and `/results` only renders after `useScanStore.setResult` runs.
- Status banners in `/scan` communicate progress (challenge issued, viewer signature captured, overlap ready) while errors (invalid JSON, missing wallet) are surfaced inline.

### Testing posture (Vitest + RTL)

- Component tests cover Cubid helpers, Auth provider bootstrapping, navigation links, scan store state, and the QR handshake happy path (`scan-page.test.tsx`).
- `results-page.test.tsx` verifies overlap rendering logic and empty-state messaging.
- Tests rely on mocked Supabase sessions, API calls, and `window.ethereum` to keep the UI deterministic.

---

## 5) EIP-712 Typed Data (Delegated)

**Domain**

- `name: "FeeGate"`
- `version: "1"`
- `chainId: 1284`
- `verifyingContract: <FeeGateAddress>`

**Types**

```
Attestation(
  address issuer,
  string cubidId,
  uint8 trustLevel,
  bool human,
  bytes32 circle,
  uint64 issuedAt,
  uint64 expiry,
  uint256 nonce,     // expected from FeeGate.issuerNonce[issuer]
  uint64  deadline   // unix seconds; FeeGate rejects after deadline
)
```

**Verification (FeeGate)**

- Check `block.timestamp <= deadline`.
- Check `nonce == issuerNonce[issuer]` then `issuerNonce[issuer]++`.
- Enforce fee rule on 3rd attestation (see §1.3).
- Call `EAS.attest` with `schemaUID` and encoded payload.

---

## 6) Economics & Anti-Spam

| Action                         |            Cost | Why                          |
| ------------------------------ | --------------: | ---------------------------- |
| 1st–2nd attestation per issuer |            Free | Onboard without friction     |
| **3rd attestation** (one-time) |    **100 GLMR** | Anti-spam + “stake to speak” |
| Later attestations             |            Free | Lifetime unlocked            |
| PSI calls                      | RL 2/s, 100/day | Avoid scraping/DoS           |

All payments handled in **FeeGate** (treasury = contract balance). Treasury withdraws gated by a multisig.

---

## 7) Security & Correctness

- **Replay-safe**: EIP-712 with **per-issuer nonce** and **deadline** in the signed message; contract checks and increments nonce (delegated); or rely on EVM account nonce in direct submits.
- **Latest-wins determinism**: Indexer prefers the attestation with **newest EAS `uid` timestamp**; FeeGate can optionally store `lastUID` to anchor ties.
- **QR anti-replay**: 90-second challenge signed by both parties before PSI.
- **Revocation**: attester can submit `trustLevel = NoOpinion` (or use EAS revoke). Indexer prunes expired ones.
- **Key hygiene**: If you run a relayer, keep its key minimal-funded and locked to FeeGate methods.

---

## 8) Deployment Plan (1–2 days)

1. **Contracts**
   - Deploy `SchemaRegistry` and `EAS` (Moonbeam).
   - Deploy `FeeGate` with pointers to `EAS` + `schemaUID`.
   - Register `CubidTrust` schema in `SchemaRegistry` with `resolver = FeeGate`.
   - Verify contracts on Moonscan.

2. **Indexer**
   - Configure to listen for `EAS.Attested`/`Revoked` for `schemaUID`.
   - Build `attestations_latest` table; expose REST.

3. **Frontend**
   - Wire Cubid SDK, Nova/EVM connect.
   - Implement Vouch (prepare → sign → relay), QR (challenge), Results.

4. **Dry-run**
   - Seed 2–3 demo issuers, vouch for 3–4 `cubidId`s.
   - Validate 3rd-attestation fee path.
   - Live demo: QR scan + overlap render.

---

## 9) Minimal Artifacts

- **Solidity**
  - `EAS/` + `SchemaRegistry/` (vendor or submodule)
  - `FeeGate.sol` (resolver + fee + nonce + optional lastUID anchor)

- **Foundry**
  - Tests: delegated sig happy-path, deadline/nonce failure, fee on 3rd, direct-submit path.
  - Scripts: deploy, register schema, set resolver.

- **Indexer (TS)**
  - `src/listener.ts` (EAS events)
  - `src/api.ts` (prepare/relay/profile/qr/psi, RL, cache)

- **Frontend (Next.js)**
  - `pages/signin.tsx`, `circle.tsx`, `vouch.tsx`, `scan.tsx`, `results.tsx`
  - `lib/eip712.ts`, `lib/api.ts`, `lib/cubid.ts`

---

## 10) Future-proofing (save for later)

- Swap PSI-server for **ZK set-intersection** later (the EAS schema remains valid).
- Add **attester reputation** and **diversity constraints**.
- Optional **People-chain binding** (dual-sig link) without altering this core.

---

end of document

This **functional specification** complements it by describing _what the system does_, _how users interact with it_, and _what behaviors are observable_, without diving into code or architecture. It’s a lean, hackathon-sized **Functional Specification** that aligns directly with the technical spec.

---

# **Functional Specification: “Known” Attestation App**

## 1. Purpose and Scope

The app enables people to **verify each other’s authenticity and trustworthiness** by creating and viewing attestations anchored on-chain.
Each attestation is a public proof that _“Person A knows/trusts Person B”_, issued via the Cubid identity layer and recorded using the Ethereum Attestation Service (EAS) on **Moonbeam**.

The MVP focuses on human-to-human verification and displaying mutual trusted connections, allowing users to quickly establish whether someone they’re interacting with online is real and vouched for by people they already trust.

---

## 2. Key User Stories

### 2.1 Authentication & Identity

- As a **user**, I can request a Supabase **magic link** (email) to establish an authenticated session without leaving the app.
- As a **user**, once signed in the system materialises an email-rooted parent profile in Supabase (`public.profiles`) keyed to my `auth_user_id`.
- As a **user**, I can link one or more wallets; each link collects my display name and photo, requests a Cubid ID, and calls `create_profile_with_credential` so Supabase mints an immutable wallet persona beneath my parent profile.
- As a **user**, I can review every wallet persona from the dashboard, with Cubid ID and avatar locked once the profile completes its first handshake.

### 2.2 Creating Attestations (Vouching)

- As a **user**, I can **vouch for another person** by entering their Cubid ID (or scanning their QR).
- I choose a **trust level** from a predefined list:
  - suspicious, no opinion, met online, met in person, known long-term, fully trusted.

- I optionally mark:
  - **human flag** (true/false)
  - **circle tag** (friends, family, coworker, etc.)
  - **expiry date** (or none = evergreen)

- On submit:
  - My wallet signs an **EIP-712 message** authorizing the attestation.
  - Power users may submit directly via `FeeGate.attestDirect`, which auto-fills the expected nonce and enforces the same fee rules.
  - The backend relays it via **FeeGate** (which checks per-issuer nonce and charges a one-time fee on the 3rd attestation).
  - FeeGate exposes `domainSeparator()`/`hashAttestation(...)` helpers so the client can assemble the digest without duplicating Solidity logic.
  - A corresponding **EAS attestation** event is emitted on-chain.

- I can issue two free attestations; my third triggers a **100 GLMR lifetime fee**.

### 2.3 Viewing Attestations (My Circle)

- As a **user**, I can view everyone I’ve vouched for and everyone who has vouched for me.
- Each entry displays:
  - Trust level
  - Circle tag
  - Issued date / expiry
  - Whether fee was paid

### 2.4 QR Handshake Verification

- As a **user**, I can tap **“Verify Someone”** to generate a time-limited QR code containing my Cubid ID.
- Another user scans it with their app; both sides:
  - Exchange temporary challenges (PSI-lite)
  - Reveal only **mutual trusted contacts**
  - See how trusted each overlap is and how recent the attestation is

- The handshake expires if unused after 90 seconds.

### 2.5 Trust Overlap Display

- When two users compare, the app shows:
  - List of mutual trusted connections (only if both sides allow it)
  - Each overlap shows: issuer’s name (short address), circle tag, freshness, and trust level.

### 2.6 Revocation

- As a **user**, I can update or revoke a prior attestation; the most recent event overrides older ones.
- Revocations are emitted as events and reflected in My Circle and overlaps.

---

## 3. User Interface Overview

### 3.1 Screens

1. **Sign-In (`/(routes)/signin`)**
   - Collects email and triggers Supabase magic-link delivery.
   - Watches `useUserStore.session`; once authenticated it redirects to either onboarding or the circle view depending on profile completeness.
   - Surfaces inline success/error states ("Check your inbox…", "Failed to send magic link").

2. **Onboarding (`/(routes)/new-user`)**
   - Guides the user through display name + photo capture, pre-generates a Cubid ID (`requestCubidId`), and requests wallet access through `ensureWallet`.
   - Calls `createWalletProfile` after wallet approval so Supabase can mint the child profile, store the wallet credential, append the Cubid history, and hydrate the store with the resulting bundle.
   - Surfaces status banners for Cubid generation, wallet linking, duplicate-address detection, and Supabase persistence before redirecting to the circle view.

3. **Profile (`/(routes)/profile`)**
   - Shows the parent email summary alongside a read-only grid of wallet personas (name, avatar, Cubid ID, wallet address) with a form to link additional wallets via the same `createWalletProfile` helper.
   - Disables edits after a profile is locked, provides a refresh button to re-fetch Supabase state, and redirects back to sign-in when no session is present.

4. **My Circle (`/(routes)/circle`)**
   - Fetches inbound/outbound attestations through `getProfile(cubidId, { issuer })`, formats freshness (seconds → minutes/hours/days), and lets users query arbitrary Cubid IDs.
   - Highlights missing onboarding by showing a warning when the viewer lacks a Cubid ID.

5. **Vouch (`/(routes)/vouch`)**
   - Collects Cubid ID, recipient wallet, trust level slider, circle hex tag, expiry, and human checkbox.
   - Calls `/attest/prepare`, prompts for `eth_signTypedData_v4`, and relays via `/attest/relay` while surfacing lifetime-fee requirements and transaction status.
   - Renders a QR preview of `{ cubidId, ts }` for quick sharing.

6. **Scan / Verify (`/(routes)/scan`)**
   - Shows the viewer’s QR payload and a helper scanner textarea for pasted JSON.
   - Parses peer payloads, requests `/qr/challenge`, records the viewer’s wallet signature, collects the peer’s signature/address, and verifies overlaps via `/qr/verify`.
   - Streams progress updates (challenge issued, viewer signature captured, overlap ready) and inline validation errors (missing cubidId, wallet access denied, unsigned target).

7. **Results (`/(routes)/results`)**
   - Reads the cached verification result from `useScanStore` and displays badge cards listing issuer short addresses, trust levels, circle tags, and freshness.
   - Shows an empty-state prompt when no verification has been performed yet.

---

## 4. System Behaviors (Functional Rules)

| Behavior                       | Description                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**             | Supabase access tokens guard QR/PSI APIs and profiles respect `auth.uid()` RLS.                                                                             |
| **Attestation Directionality** | Trust is one-way; A→B doesn’t imply B→A.                                                                                                                    |
| **Latest Wins**                | The latest attestation (preferring FeeGate’s `getLastUID` anchor when present, otherwise block time) overrides any prior between the same issuer & subject. |
| **Signature Deadlines**        | Delegated attestations expire once `block.timestamp` exceeds the signed deadline, preventing replay attacks.                                                |
| **Fee Enforcement**            | FeeGate enforces 100 GLMR charge on 3rd attestation; 1st and 2nd are free.                                                                                  |
| **Delegated Signing**          | EIP-712 signatures allow gasless submission via app relayer.                                                                                                |
| **Expiry Handling**            | Indexer filters out expired attestations; chain does not auto-delete them.                                                                                  |
| **Privacy**                    | Only Cubid IDs plus optional display name/photo are stored; Supabase RLS blocks cross-user reads.                                                           |
| **Rate Limits**                | Indexer limits read requests (2 req/s per IP; 100/day).                                                                                                     |
| **Caching**                    | Overlap results cached for 120 s to avoid redundant computation.                                                                                            |
| **Challenge Validity**         | QR challenges expire after 90 s and cannot be reused.                                                                                                       |

---

## 5. External Interactions

| Component                              | Purpose                                | Interaction                                                                                                                                                                           |
| -------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase Auth**                      | Session management & profile storage   | Next.js uses `@supabase/supabase-js` for magic link auth, the `create_profile_with_credential` RPC, and `profiles_enriched` reads; indexer verifies JWTs using `SUPABASE_JWT_SECRET`. |
| **Cubid SDK**                          | Authentication & issuance of Cubid IDs | App still invokes Cubid flows post-login to obtain Cubid IDs for attestations.                                                                                                        |
| **EAS (Ethereum Attestation Service)** | On-chain attestation registry          | FeeGate relays attestations to EAS contracts.                                                                                                                                         |
| **FeeGate Resolver**                   | Validation & spam control              | Enforces per-issuer nonce and fee threshold.                                                                                                                                          |
| **Moonbeam RPC**                       | Blockchain backend                     | Transactions and event subscriptions.                                                                                                                                                 |
| **Indexer (Node.js)**                  | Off-chain aggregator                   | Subscribes to EAS events; exposes REST API.                                                                                                                                           |
| **Frontend (Next.js)**                 | User interface                         | Fetches and posts to indexer API.                                                                                                                                                     |

---

## 6. API Endpoints (Functional Behavior)

| Endpoint                | Method | Description                                                         |
| ----------------------- | ------ | ------------------------------------------------------------------- |
| `/api/attest/prepare`   | POST   | Returns EIP-712 message to sign for given attestation input         |
| `/api/attest/relay`     | POST   | Submits signed data to FeeGate and relays tx                        |
| `/api/profile/:cubidId` | GET    | Lists inbound/outbound attestations for a Cubid ID                  |
| `/api/qr/challenge`     | GET    | Issues one-time challenge for QR handshake (Supabase auth required) |
| `/api/qr/verify`        | POST   | Validates challenge signatures and returns overlaps (Supabase auth) |
| `/api/overlaps`         | POST   | (Optional) Computes overlaps directly between two Cubid IDs         |

---

## 7. Success Metrics

| Metric                               | Target                   |
| ------------------------------------ | ------------------------ |
| Attestation creation success         | > 95% (within 30 s)      |
| Average QR verification latency      | < 3 s                    |
| Cost per attestation                 | < $0.02 (Moonbeam gas)   |
| Rate of duplicate spam               | < 1% of all attestations |
| Successful mutual match rate in demo | ≥ 90%                    |

---

## 8. Non-Functional Requirements

- **Performance:** API responses under 500 ms except during chain lag.
- **Scalability:** Indexer supports 10 000 attestations in SQLite without degradation.
- **Reliability:** System recovers on restart and replays chain events.
- **Privacy:** No raw emails/phones stored—Supabase holds Cubid IDs plus optional display name/photo under RLS.
- **Availability:** ≥ 99% during demo window.
- **Usability:** Each flow completable in ≤ 4 taps.

---

## 9. Constraints and Future Enhancements

- **Hackathon constraint:** No liveness or zero-knowledge proofs.
- **Future upgrade:** Replace PSI with ZK-set intersection; integrate direct Cubid scores.
- **Future chain option:** Mirror attestations to Polkadot Asset Hub once PolkaVM matures.

---

## 10. Deliverables Summary

- Working web app on Vercel (Next.js)
- Supabase project linked with the multi-profile Supabase schema (`public.profiles`, `public.profile_credentials`, `public.profiles_cubid`) and environment wiring
- Smart contracts (EAS fork + FeeGate) deployed on Moonbeam
- Indexer API running publicly
- Supabase magic-link authentication bridged with Cubid ID assignment
- Demonstrable handshake flow showing shared trusted contacts
- MIT-licensed codebase with README and deployment docs

---

## 11. Deployment & Operations (Session 09)

- **Release checklist:** Run the full quality gate (`pnpm lint`, builds, tests across workspaces) before promoting any commit.
- **Contracts:** Broadcast via Foundry scripts with `--verify` and capture addresses + Moonscan links in `agent-context/eas-addresses.md`.
- **Indexer:** Deploy the Docker image on Fly.io (or Render) and configure secrets for RPC endpoints, Supabase credentials, and contract IDs. `/healthz` is the primary readiness probe.
- **Frontend:** Ship to Vercel with environment variables mirroring the production indexer + contract addresses. Preview deployments should use the same Supabase anon key to exercise auth.
- **Documentation:** `agent-context/deployment.md` now records the full procedure and must be updated with URLs, transaction hashes, and release tags after each rollout.
- **Incident response:** In case of failure, roll back via Vercel deployment promotion or `fly deploy --image <previous>` while keeping contract data immutable. Record remedial steps in the session log.

---

This **Functional Specification** expresses _what the system does_ from the user’s perspective — clean, behavioral, and outcome-driven — and should be kept fully consistent with your _Technical Specification_ that defines _how_ it’s done.

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
- As a **user**, once signed in I can populate my profile in `public.users` with a **Cubid ID**, **display name**, and optional **photo URL** that other features rely on.
- As a **user**, I can optionally connect an **EVM wallet (Nova Wallet)** to fund or sign attestations, and the linked address is stored with my Supabase profile.

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

1. **Sign-In**
   - Request Supabase magic link and confirm session status
   - Capture Cubid ID / display name / photo for the Supabase profile
   - Connect wallet (Nova) and persist the selected address

2. **My Circle**
   - Tabs: _I Trust_ / _Trusts Me_
   - List of attestations (avatar, circle, level)
   - “Vouch for New Contact” button

3. **Vouch**
   - Form fields: target Cubid ID, trust level, circle, expiry toggle
   - Submit button → triggers signing flow
   - Displays fee notice on 3rd attestation

4. **Scan / Verify**
   - Show QR of own Cubid ID
   - Scan peer QR → initiate handshake
   - Show verifying state / spinner

5. **Results**
   - List of mutual trusted contacts
   - Visual indicator of freshness (new / old)
   - Option to vouch for peer directly from this page

---

## 4. System Behaviors (Functional Rules)

| Behavior                       | Description                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Authentication**             | Supabase access tokens guard QR/PSI APIs and profiles respect `auth.uid()` RLS.                      |
| **Attestation Directionality** | Trust is one-way; A→B doesn’t imply B→A.                                                             |
| **Latest Wins**                | The latest attestation (by UID or block time) overrides any prior between the same issuer & subject. |
| **Fee Enforcement**            | FeeGate enforces 100 GLMR charge on 3rd attestation; 1st and 2nd are free.                           |
| **Delegated Signing**          | EIP-712 signatures allow gasless submission via app relayer.                                         |
| **Expiry Handling**            | Indexer filters out expired attestations; chain does not auto-delete them.                           |
| **Privacy**                    | Only Cubid IDs plus optional display name/photo are stored; Supabase RLS blocks cross-user reads.    |
| **Rate Limits**                | Indexer limits read requests (2 req/s per IP; 100/day).                                              |
| **Caching**                    | Overlap results cached for 120 s to avoid redundant computation.                                     |
| **Challenge Validity**         | QR challenges expire after 90 s and cannot be reused.                                                |

---

## 5. External Interactions

| Component                              | Purpose                                | Interaction                                                                                                                   |
| -------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Supabase Auth**                      | Session management & profile storage   | Next.js uses `@supabase/supabase-js` for magic link auth and profile CRUD; indexer verifies JWTs using `SUPABASE_JWT_SECRET`. |
| **Cubid SDK**                          | Authentication & issuance of Cubid IDs | App still invokes Cubid flows post-login to obtain Cubid IDs for attestations.                                                |
| **EAS (Ethereum Attestation Service)** | On-chain attestation registry          | FeeGate relays attestations to EAS contracts.                                                                                 |
| **FeeGate Resolver**                   | Validation & spam control              | Enforces per-issuer nonce and fee threshold.                                                                                  |
| **Moonbeam RPC**                       | Blockchain backend                     | Transactions and event subscriptions.                                                                                         |
| **Indexer (Node.js)**                  | Off-chain aggregator                   | Subscribes to EAS events; exposes REST API.                                                                                   |
| **Frontend (Next.js)**                 | User interface                         | Fetches and posts to indexer API.                                                                                             |

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
- Supabase project linked with `public.users` migration and environment wiring
- Smart contracts (EAS fork + FeeGate) deployed on Moonbeam
- Indexer API running publicly
- Supabase magic-link authentication bridged with Cubid ID assignment
- Demonstrable handshake flow showing shared trusted contacts
- MIT-licensed codebase with README and deployment docs

---

This **Functional Specification** expresses _what the system does_ from the user’s perspective — clean, behavioral, and outcome-driven — and should be kept fully consistent with your _Technical Specification_ that defines _how_ it’s done.

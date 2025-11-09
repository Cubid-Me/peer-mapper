# Peer-mapper API Reference (Session 06)

This document captures the attestation submission surface that the frontend will
call. All responses use JSON and include `Content-Type: application/json`.

## `POST /attest/prepare`

Returns EIP-712 typed data for the issuer to sign, along with fee metadata for
the upcoming attestation.

- **Auth:** none
- **Request headers:** `Content-Type: application/json`
- **Request body:**
  ```json
  {
    "issuer": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "recipient": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "cubidId": "friend-123",
    "trustLevel": 5,
    "human": true,
    "circle": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "issuedAt": 1700000000,
    "expiry": 0,
    "refUID": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "revocable": true,
    "expirationTime": 0
  }
  ```
- **Success (200):**
  ```json
  {
    "typedData": {
      "domain": {
        "name": "FeeGate",
        "version": "1",
        "chainId": 1284,
        "verifyingContract": "0x1111111111111111111111111111111111111111"
      },
      "types": {
        "Attestation": [
          { "name": "issuer", "type": "address" },
          { "name": "recipient", "type": "address" },
          { "name": "refUID", "type": "bytes32" },
          { "name": "revocable", "type": "bool" },
          { "name": "expirationTime", "type": "uint64" },
          { "name": "cubidId", "type": "string" },
          { "name": "trustLevel", "type": "uint8" },
          { "name": "human", "type": "bool" },
          { "name": "circle", "type": "bytes32" },
          { "name": "issuedAt", "type": "uint64" },
          { "name": "expiry", "type": "uint64" },
          { "name": "nonce", "type": "uint256" },
          { "name": "deadline", "type": "uint64" }
        ]
      },
      "primaryType": "Attestation",
      "message": {
        "issuer": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "recipient": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "refUID": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "revocable": true,
        "expirationTime": 0,
        "cubidId": "friend-123",
        "trustLevel": 5,
        "human": true,
        "circle": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "issuedAt": 1700000000,
        "expiry": 0,
        "nonce": "1",
        "deadline": 1700000300
      }
    },
    "meta": {
      "nonce": "1",
      "nextCount": "3",
      "fee": {
        "required": true,
        "amount": "100000000000000000000"
      }
    }
  }
  ```
- **Error (400):** validation failure (`invalid_request`).
- **Notes:** the `deadline` is always current UTC time + 5 minutes. Frontend must
  convert `nonce` and `deadline` back to numeric/bigint values before calling
  the wallet signer.

## `POST /attest/relay`

Relays the wallet-signed payload via the relayer key. Returns the transaction
hash once one confirmation is observed.

- **Auth:** none
- **Request headers:** `Content-Type: application/json`
- **Request body:**
  ```json
  {
    "issuer": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "signature": "0x7c...",
    "value": "100000000000000000000",
    "payload": {
      "recipient": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "refUID": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "revocable": true,
      "expirationTime": 0,
      "cubidId": "friend-123",
      "trustLevel": 5,
      "human": true,
      "circle": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "issuedAt": 1700000000,
      "expiry": 0,
      "nonce": "1",
      "deadline": 1700000300
    }
  }
  ```
- **Success (202):**
  ```json
  {
    "txHash": "0x9f...",
    "status": "success",
    "blockNumber": "1234567",
    "gasUsed": "210000"
  }
  ```
- **Error (400):** validation failure (`invalid_request`).
- **Error (500):** relayer misconfiguration, RPC failure, or transaction
  rejection. Client should retry only after inspecting the error body.
- **Notes:** `value` is expressed in wei. Pass `0` when no lifetime fee is due.

---

## `GET /profile/:cubidId`

Returns the latest inbound attestations about the provided Cubid ID and, when an
`issuer` query string is supplied, the outbound attestations issued by that
wallet. Rows where `expiry` has passed are filtered out.

- **Auth:** none
- **Query params:**
  - `issuer` (optional) — 0x-prefixed EVM address to fetch outbound vouches.
- **Success (200):**
  ```json
  {
    "cubidId": "viewer",
    "inbound": [
      {
        "issuer": "0xIssuerInbound",
        "cubidId": "viewer",
        "trustLevel": 3,
        "human": true,
        "circle": null,
        "issuedAt": 1700000000,
        "expiry": 0,
        "uid": "0x01",
        "freshnessSeconds": 120
      }
    ],
    "outbound": [
      {
        "issuer": "0xIssuerViewer",
        "cubidId": "friend-1",
        "trustLevel": 5,
        "human": true,
        "circle": "0x1234",
        "issuedAt": 1700000300,
        "expiry": 0,
        "uid": "0x02",
        "freshnessSeconds": 45
      }
    ]
  }
  ```
- **Error (400):** malformed Cubid ID or issuer query.

## `GET /qr/challenge`

Issues a short-lived challenge for a Cubid ID. Requires a Supabase access token
generated via magic-link sign in.

- **Auth:** `Authorization: Bearer <supabase_access_token>`
- **Query params:** `issuedFor` (string) — target Cubid ID.
- **Success (200):**
  ```json
  {
    "challengeId": "uuid",
    "challenge": "peer-mapper:d6f...",
    "issuedFor": "cubid_friend",
    "expiresAt": 1700000123
  }
  ```
- **Error (401):** missing/invalid Supabase JWT.
- **Error (400):** invalid Cubid ID.

## `POST /qr/verify`

Verifies viewer and target signatures over a previously issued challenge,
records it as used, and returns trust overlaps.

- **Auth:** `Authorization: Bearer <supabase_access_token>`
- **Request body:**
  ```json
  {
    "challengeId": "uuid",
    "challenge": "peer-mapper:d6f...",
    "viewer": {
      "cubidId": "viewer",
      "address": "0xviewer",
      "signature": "0xviewerSig"
    },
    "target": {
      "cubidId": "target",
      "address": "0xtarget",
      "signature": "0xtargetSig"
    }
  }
  ```
- **Success (200):**
  ```json
  {
    "challengeId": "uuid",
    "expiresAt": 1700000123,
    "overlaps": [
      {
        "issuer": "0xIssuerInbound",
        "trustLevel": 3,
        "circle": null,
        "freshnessSeconds": 120
      }
    ]
  }
  ```
- **Error (409):** challenge already used.
- **Error (410):** challenge expired.
- **Error (400):** invalid signatures or malformed payload.

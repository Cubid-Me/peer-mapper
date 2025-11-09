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

Other routes (`/profile`, `/qr/*`, `/psi/*`) remain unchanged from the Session 05
implementation and will be updated in a later pass when their behaviour
solidifies.

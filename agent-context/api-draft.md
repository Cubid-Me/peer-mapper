# API Draft (Session 1 Snapshot)

| Route               | Method | Description                                 | Status |
| ------------------- | ------ | ------------------------------------------- | ------ |
| `/attest/prepare`   | POST   | Returns EIP-712 payload + FeeGate nonce     | stub   |
| `/attest/relay`     | POST   | Relays signed payload to FeeGate            | stub   |
| `/profile/:cubidId` | GET    | Latest inbound attestations                 | stub   |
| `/qr/challenge`     | GET    | Issues short-lived handshake tokens         | stub   |
| `/qr/verify`        | POST   | Validates both signatures then triggers PSI | stub   |
| `/psi/intersection` | POST   | Computes trusted overlaps                   | stub   |

Next session will flesh out schema, DTOs, and error envelopes.

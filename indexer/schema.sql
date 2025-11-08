CREATE TABLE IF NOT EXISTS attestations_latest (
    issuer       TEXT NOT NULL,
    cubid_id     TEXT NOT NULL,
    trust_level  INTEGER NOT NULL,
    human        INTEGER NOT NULL,
    circle       BLOB,
    issued_at    INTEGER NOT NULL,
    expiry       INTEGER NOT NULL,
    uid          TEXT NOT NULL,
    block_time   INTEGER NOT NULL,
    PRIMARY KEY (issuer, cubid_id)
);

CREATE TABLE IF NOT EXISTS issuers (
    issuer         TEXT PRIMARY KEY,
    attest_count   INTEGER NOT NULL DEFAULT 0,
    fee_paid       INTEGER NOT NULL DEFAULT 0,
    expected_nonce INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS qr_challenges (
    id         TEXT PRIMARY KEY,
    issued_for TEXT NOT NULL,
    challenge  TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0
);

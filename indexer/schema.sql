CREATE TABLE IF NOT EXISTS issuers (
    issuer         TEXT PRIMARY KEY,
    attest_count   INTEGER NOT NULL DEFAULT 0,
    lifetime_paid  BOOLEAN NOT NULL DEFAULT FALSE,
    expected_nonce INTEGER NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attestations_latest (
    issuer        TEXT NOT NULL,
    cubid_id      TEXT NOT NULL,
    trust_level   INTEGER NOT NULL,
    human         BOOLEAN NOT NULL,
    circle        TEXT,
    issued_at     BIGINT NOT NULL,
    expiry        BIGINT NOT NULL,
    uid           TEXT NOT NULL,
    block_time    BIGINT NOT NULL,
    PRIMARY KEY (issuer, cubid_id)
);

CREATE TABLE IF NOT EXISTS qr_challenges (
    id          TEXT PRIMARY KEY,
    issued_for  TEXT NOT NULL,
    expires_at  BIGINT NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

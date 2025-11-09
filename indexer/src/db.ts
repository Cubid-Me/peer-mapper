import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { getEnv } from './env';

export interface AttestationRecord {
  issuer: string;
  cubidId: string;
  trustLevel: number;
  human: boolean;
  circle: Buffer | null;
  issuedAt: number;
  expiry: number;
  uid: string;
  blockTime: number;
}

export interface IssuerRecord {
  issuer: string;
  attestCount: number;
  feePaid: boolean;
  expectedNonce: number;
}

export interface QrChallengeRecord {
  id: string;
  issuedFor: string;
  challenge: string;
  expiresAt: number;
  used: boolean;
}

type AttestationRow = {
  issuer: string;
  cubidId: string;
  trustLevel: number;
  human: number;
  circle: Buffer | null;
  issuedAt: number;
  expiry: number;
  uid: string;
  blockTime: number;
};

type QrChallengeRow = {
  id: string;
  issuedFor: string;
  challenge: string;
  expiresAt: number;
  used: number;
};

const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000';

function normaliseUid(uid: string): string {
  if (uid === '0x0') {
    return ZERO_UID;
  }

  return uid.toLowerCase();
}

function isMeaningfulAnchor(anchor?: string): anchor is string {
  if (!anchor) {
    return false;
  }

  const normalised = normaliseUid(anchor);
  return normalised !== ZERO_UID;
}

export class IndexerDatabase {
  private readonly db: Database.Database;

  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  migrate(schemaFile = path.resolve(__dirname, '..', 'schema.sql')): void {
    const schema = fs.readFileSync(schemaFile, 'utf8');
    this.db.exec('BEGIN');
    this.db.exec(schema);
    this.db.exec('COMMIT');
  }

  upsertAttestation(record: AttestationRecord, anchorUid?: string): boolean {
    const recordUid = normaliseUid(record.uid);
    const canonicalAnchor = isMeaningfulAnchor(anchorUid) ? normaliseUid(anchorUid) : undefined;

    const existing = this.db
      .prepare('SELECT uid, block_time FROM attestations_latest WHERE issuer = ? AND cubid_id = ?')
      .get(record.issuer, record.cubidId) as { uid: string; block_time: number } | undefined;

    if (canonicalAnchor) {
      if (recordUid !== canonicalAnchor) {
        return false;
      }
    } else if (existing) {
      if (existing.block_time > record.blockTime) {
        return false;
      }

      const existingUid = normaliseUid(existing.uid);
      if (existing.block_time === record.blockTime && existingUid.localeCompare(recordUid) >= 0) {
        return false;
      }
    }

    this.db
      .prepare(
        `INSERT INTO attestations_latest (
            issuer, cubid_id, trust_level, human, circle, issued_at, expiry, uid, block_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(issuer, cubid_id) DO UPDATE SET
            trust_level = excluded.trust_level,
            human = excluded.human,
            circle = excluded.circle,
            issued_at = excluded.issued_at,
            expiry = excluded.expiry,
            uid = excluded.uid,
            block_time = excluded.block_time`,
      )
      .run(
        record.issuer,
        record.cubidId,
        record.trustLevel,
        record.human ? 1 : 0,
        record.circle,
        record.issuedAt,
        record.expiry,
        recordUid,
        record.blockTime,
      );

    return true;
  }

  markRevoked(issuer: string, cubidId: string, uid: string): boolean {
    const normalisedUid = normaliseUid(uid);
    const existing = this.db
      .prepare('SELECT uid FROM attestations_latest WHERE issuer = ? AND cubid_id = ?')
      .get(issuer, cubidId) as { uid: string } | undefined;

    if (!existing || normaliseUid(existing.uid) !== normalisedUid) {
      return false;
    }

    this.db
      .prepare('DELETE FROM attestations_latest WHERE issuer = ? AND cubid_id = ?')
      .run(issuer, cubidId);

    return true;
  }

  deleteByUid(uid: string): boolean {
    const normalisedUid = normaliseUid(uid);
    const existing = this.db
      .prepare('SELECT issuer, cubid_id FROM attestations_latest WHERE uid = ?')
      .get(normalisedUid) as { issuer: string; cubid_id: string } | undefined;

    if (!existing) {
      return false;
    }

    this.db.prepare('DELETE FROM attestations_latest WHERE uid = ?').run(normalisedUid);
    return true;
  }

  getAttestation(issuer: string, cubidId: string): AttestationRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT issuer, cubid_id as cubidId, trust_level as trustLevel, human, circle, issued_at as issuedAt,
                expiry, uid, block_time as blockTime
         FROM attestations_latest
         WHERE issuer = ? AND cubid_id = ?`,
      )
      .get(issuer, cubidId) as AttestationRow | undefined;

    if (!row) {
      return undefined;
    }

    return {
      issuer: row.issuer,
      cubidId: row.cubidId,
      trustLevel: row.trustLevel,
      human: Boolean(row.human),
      circle: row.circle ?? null,
      issuedAt: row.issuedAt,
      expiry: row.expiry,
      uid: row.uid,
      blockTime: row.blockTime,
    };
  }

  listTables(): string[] {
    const rows = this.db
      .prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name ASC')
      .all('table') as { name: string }[];

    return rows.map((row) => row.name);
  }

  upsertIssuer(record: IssuerRecord): void {
    this.db
      .prepare(
        `INSERT INTO issuers (issuer, attest_count, fee_paid, expected_nonce)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(issuer) DO UPDATE SET
           attest_count = excluded.attest_count,
           fee_paid = excluded.fee_paid,
           expected_nonce = excluded.expected_nonce`,
      )
      .run(record.issuer, record.attestCount, record.feePaid ? 1 : 0, record.expectedNonce);
  }

  listAttestationsForCubid(cubidId: string): AttestationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT issuer, cubid_id as cubidId, trust_level as trustLevel, human, circle, issued_at as issuedAt,
                expiry, uid, block_time as blockTime
         FROM attestations_latest
         WHERE cubid_id = ?`,
      )
      .all(cubidId) as AttestationRow[];

    return rows.map((row) => ({
      issuer: row.issuer,
      cubidId: row.cubidId,
      trustLevel: row.trustLevel,
      human: Boolean(row.human),
      circle: row.circle ?? null,
      issuedAt: row.issuedAt,
      expiry: row.expiry,
      uid: row.uid,
      blockTime: row.blockTime,
    }));
  }

  listAttestationsByIssuer(issuer: string): AttestationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT issuer, cubid_id as cubidId, trust_level as trustLevel, human, circle, issued_at as issuedAt,
                expiry, uid, block_time as blockTime
         FROM attestations_latest
         WHERE issuer = ?`,
      )
      .all(issuer) as AttestationRow[];

    return rows.map((row) => ({
      issuer: row.issuer,
      cubidId: row.cubidId,
      trustLevel: row.trustLevel,
      human: Boolean(row.human),
      circle: row.circle ?? null,
      issuedAt: row.issuedAt,
      expiry: row.expiry,
      uid: row.uid,
      blockTime: row.blockTime,
    }));
  }

  createQrChallenge(record: QrChallengeRecord): void {
    this.db
      .prepare(
        `INSERT INTO qr_challenges (id, issued_for, challenge, expires_at, used)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(record.id, record.issuedFor, record.challenge, record.expiresAt, record.used ? 1 : 0);
  }

  getQrChallenge(id: string): QrChallengeRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT id, issued_for as issuedFor, challenge, expires_at as expiresAt, used
         FROM qr_challenges
         WHERE id = ?`,
      )
      .get(id) as QrChallengeRow | undefined;

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      issuedFor: row.issuedFor,
      challenge: row.challenge,
      expiresAt: row.expiresAt,
      used: Boolean(row.used),
    };
  }

  markQrChallengeUsed(id: string): boolean {
    const result = this.db
      .prepare('UPDATE qr_challenges SET used = 1 WHERE id = ? AND used = 0')
      .run(id);

    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}

let singleton: IndexerDatabase | undefined;

export function getDatabase(): IndexerDatabase {
  if (!singleton) {
    const env = getEnv();
    singleton = new IndexerDatabase(env.databaseUrl);
    singleton.migrate();
  }
  return singleton;
}

export function resetSingleton(): void {
  singleton = undefined;
}

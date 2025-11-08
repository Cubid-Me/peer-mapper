import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { env } from './env';

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

  upsertAttestation(record: AttestationRecord): boolean {
    const existing = this.db
      .prepare('SELECT uid, block_time FROM attestations_latest WHERE issuer = ? AND cubid_id = ?')
      .get(record.issuer, record.cubidId) as { uid: string; block_time: number } | undefined;

    if (existing) {
      if (existing.block_time > record.blockTime) {
        return false;
      }

      if (existing.block_time === record.blockTime && existing.uid.localeCompare(record.uid) >= 0) {
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
        record.uid,
        record.blockTime,
      );

    return true;
  }

  markRevoked(issuer: string, cubidId: string, uid: string): boolean {
    const existing = this.db
      .prepare('SELECT uid FROM attestations_latest WHERE issuer = ? AND cubid_id = ?')
      .get(issuer, cubidId) as { uid: string } | undefined;

    if (!existing || existing.uid !== uid) {
      return false;
    }

    this.db
      .prepare('DELETE FROM attestations_latest WHERE issuer = ? AND cubid_id = ?')
      .run(issuer, cubidId);

    return true;
  }

  deleteByUid(uid: string): boolean {
    const existing = this.db
      .prepare('SELECT issuer, cubid_id FROM attestations_latest WHERE uid = ?')
      .get(uid) as { issuer: string; cubid_id: string } | undefined;

    if (!existing) {
      return false;
    }

    this.db.prepare('DELETE FROM attestations_latest WHERE uid = ?').run(uid);
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
      .get(issuer, cubidId) as (AttestationRecord & { human: number }) | undefined;

    if (!row) {
      return undefined;
    }

    return {
      ...row,
      human: Boolean(row.human),
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

  close(): void {
    this.db.close();
  }
}

let singleton: IndexerDatabase | undefined;

export function getDatabase(): IndexerDatabase {
  if (!singleton) {
    singleton = new IndexerDatabase(env.databaseUrl);
    singleton.migrate();
  }
  return singleton;
}

export function resetSingleton(): void {
  singleton = undefined;
}

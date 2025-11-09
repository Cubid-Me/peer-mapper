import { encodeAbiParameters, Hex } from 'viem';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IndexerDatabase } from '../src/db';
import { refreshEnv } from '../src/env';
import { decodeAttestationData, processAttested, processRevoked } from '../src/listener';

const schemaFields = [
  { name: 'cubidId', type: 'string' },
  { name: 'trustLevel', type: 'uint8' },
  { name: 'human', type: 'bool' },
  { name: 'circle', type: 'bytes32' },
  { name: 'issuedAt', type: 'uint64' },
  { name: 'expiry', type: 'uint64' },
  { name: 'nonce', type: 'uint256' },
] as const;

describe('listener helpers', () => {
  let db: IndexerDatabase;

  beforeEach(() => {
    process.env.SCHEMA_UID = '0x1234';
    refreshEnv();
    db = new IndexerDatabase(':memory:');
    db.migrate();
  });

  afterEach(() => {
    db.close();
    delete process.env.SCHEMA_UID;
    refreshEnv();
  });

  it('decodes attestation payloads', () => {
    const encoded = encodeAbiParameters(schemaFields, [
      'cubid:bob',
      2n,
      true,
      '0x' + 'ab'.repeat(32),
      1_700_000_500n,
      0n,
      7n,
    ]) as Hex;

    const decoded = decodeAttestationData(encoded);
    expect(decoded.cubidId).toBe('cubid:bob');
    expect(decoded.trustLevel).toBe(2);
    expect(decoded.human).toBe(true);
    expect(decoded.circle).toBeTypeOf('string');
  });

  it('persists attested events when schema matches', async () => {
    const data = encodeAbiParameters(schemaFields, [
      'cubid:alice',
      4n,
      false,
      '0x' + 'cd'.repeat(32),
      1_700_000_000n,
      0n,
      11n,
    ]) as Hex;

    const updated = await processAttested(
      {
        uid: '0x01',
        attester: '0x00000000000000000000000000000000000000aa',
        schemaUID: '0x1234',
        blockTime: 1_700_000_100,
        data,
      },
      db,
    );

    expect(updated).toBe(true);
    const row = db.getAttestation('0x00000000000000000000000000000000000000aa', 'cubid:alice');
    expect(row).toBeDefined();
    expect(row?.trustLevel).toBe(4);
    expect(row?.human).toBe(false);
    expect(row?.circle?.length).toBe(32);
  });

  it('ignores attestations for other schemas', async () => {
    const data = encodeAbiParameters(schemaFields, [
      'cubid:ignored',
      1n,
      false,
      '0x' + '00'.repeat(32),
      0n,
      0n,
      0n,
    ]) as Hex;

    const updated = await processAttested(
      {
        uid: '0x02',
        attester: '0x00000000000000000000000000000000000000bb',
        schemaUID: '0xdead',
        blockTime: 1,
        data,
      },
      db,
    );

    expect(updated).toBe(false);
    expect(db.getAttestation('0x00000000000000000000000000000000000000bb', 'cubid:ignored')).toBeUndefined();
  });

  it('removes attestations on revocation', async () => {
    const data = encodeAbiParameters(schemaFields, [
      'cubid:carol',
      3n,
      true,
      '0x' + 'ef'.repeat(32),
      1_700_000_200n,
      0n,
      0n,
    ]) as Hex;

    await processAttested(
      {
        uid: '0x10',
        attester: '0x00000000000000000000000000000000000000cc',
        schemaUID: '0x1234',
        blockTime: 10,
        data,
      },
      db,
    );

    const removed = processRevoked({ uid: '0x10', schemaUID: '0x1234' }, db);
    expect(removed).toBe(true);
    expect(db.getAttestation('0x00000000000000000000000000000000000000cc', 'cubid:carol')).toBeUndefined();
  });
});

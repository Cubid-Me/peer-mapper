import pino from 'pino';
import { createPublicClient, decodeAbiParameters, Hex, http } from 'viem';
import { moonbeam } from 'viem/chains';

import { AttestationRecord, getDatabase, IndexerDatabase } from './db';
import { getEnv } from './env';

const ATTESTATION_FIELDS = [
  { name: 'cubidId', type: 'string' },
  { name: 'trustLevel', type: 'uint8' },
  { name: 'human', type: 'bool' },
  { name: 'circle', type: 'bytes32' },
  { name: 'issuedAt', type: 'uint64' },
  { name: 'expiry', type: 'uint64' },
  { name: 'nonce', type: 'uint256' },
] as const;

const EAS_ABI = [
  {
    type: 'event',
    name: 'Attested',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'attester', type: 'address', indexed: true },
      { name: 'uid', type: 'bytes32', indexed: false },
      { name: 'schemaUID', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Revoked',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'attester', type: 'address', indexed: true },
      { name: 'uid', type: 'bytes32', indexed: false },
      { name: 'schemaUID', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'function',
    name: 'getAttestation',
    stateMutability: 'view',
    inputs: [{ name: 'uid', type: 'bytes32' }],
    outputs: [
      {
        name: 'attestation',
        type: 'tuple',
        components: [
          { name: 'uid', type: 'bytes32' },
          { name: 'schema', type: 'bytes32' },
          { name: 'time', type: 'uint64' },
          { name: 'expirationTime', type: 'uint64' },
          { name: 'revocationTime', type: 'uint64' },
          { name: 'refUID', type: 'bytes32' },
          { name: 'recipient', type: 'address' },
          { name: 'attester', type: 'address' },
          { name: 'revocable', type: 'bool' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
  },
] as const;

export interface AttestedLog {
  uid: `0x${string}`;
  attester: `0x${string}`;
  schemaUID: `0x${string}`;
  blockTime: number;
  data: Hex;
}

export interface RevokedLog {
  uid: `0x${string}`;
  schemaUID: `0x${string}`;
}

export interface ListenerOptions {
  logger?: pino.Logger;
  transportUrl?: string;
  database?: IndexerDatabase;
}

export function decodeAttestationData(data: Hex) {
  const [cubidId, trustLevel, human, circle, issuedAt, expiry] = decodeAbiParameters(
    ATTESTATION_FIELDS,
    data,
  );

  return {
    cubidId: cubidId as string,
    trustLevel: Number(trustLevel),
    human: Boolean(human),
    circle: circle as Hex,
    issuedAt: Number(issuedAt),
    expiry: Number(expiry),
  };
}

function hexToBuffer(value: Hex): Buffer | null {
  if (value === '0x' || /^0x0+$/.test(value)) {
    return null;
  }

  return Buffer.from(value.slice(2), 'hex');
}

export async function processAttested(
  log: AttestedLog,
  database: IndexerDatabase = getDatabase(),
): Promise<boolean> {
  const env = getEnv();
  if (log.schemaUID.toLowerCase() !== env.schemaUid.toLowerCase()) {
    return false;
  }

  const decoded = decodeAttestationData(log.data);
  const attestation: AttestationRecord = {
    issuer: log.attester.toLowerCase(),
    cubidId: decoded.cubidId,
    trustLevel: decoded.trustLevel,
    human: decoded.human,
    circle: hexToBuffer(decoded.circle),
    issuedAt: decoded.issuedAt,
    expiry: decoded.expiry,
    uid: log.uid,
    blockTime: log.blockTime,
  };

  return database.upsertAttestation(attestation);
}

export function processRevoked(
  log: RevokedLog,
  database: IndexerDatabase = getDatabase(),
): boolean {
  const env = getEnv();
  if (log.schemaUID.toLowerCase() !== env.schemaUid.toLowerCase()) {
    return false;
  }

  return database.deleteByUid(log.uid);
}

export function startListener(options: ListenerOptions = {}): () => void {
  const logger = options.logger ?? pino({ name: 'indexer-listener' });
  const database = options.database ?? getDatabase();
  const env = getEnv();
  const transportUrl = options.transportUrl ?? env.rpcUrl;

  if (!transportUrl) {
    logger.warn('MOONBEAM_RPC not configured; on-chain listener disabled');
    return () => {};
  }

  const client = createPublicClient({
    chain: moonbeam,
    transport: http(transportUrl),
  });

  const attestationWatcher = client.watchContractEvent({
    address: env.easAddress as `0x${string}`,
    abi: EAS_ABI,
    eventName: 'Attested',
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          if (!log.args) continue;
          const block = await client.getBlock({ blockNumber: log.blockNumber! });
          const attestation = (await client.readContract({
            address: env.easAddress as `0x${string}`,
            abi: EAS_ABI,
            functionName: 'getAttestation',
            args: [log.args.uid as `0x${string}`],
          })) as { data: Hex; attester: `0x${string}` };

          await processAttested(
            {
              uid: log.args.uid as `0x${string}`,
              attester: attestation.attester ?? (log.args.attester as `0x${string}`),
              schemaUID: log.args.schemaUID as `0x${string}`,
              blockTime: Number(block.timestamp),
              data: attestation.data,
            },
            database,
          );
        } catch (error) {
          logger.error({ err: error }, 'failed to process attested log');
        }
      }
    },
  });

  const revocationWatcher = client.watchContractEvent({
    address: env.easAddress as `0x${string}`,
    abi: EAS_ABI,
    eventName: 'Revoked',
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          if (!log.args) continue;
          processRevoked(
            {
              uid: log.args.uid as `0x${string}`,
              schemaUID: log.args.schemaUID as `0x${string}`,
            },
            database,
          );
        } catch (error) {
          logger.error({ err: error }, 'failed to process revoked log');
        }
      }
    },
  });

  return () => {
    attestationWatcher();
    revocationWatcher();
    logger.info('Indexer listener stopped');
  };
}

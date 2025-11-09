import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  signatureToVRS,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { moonbeam } from 'viem/chains';

import { getEnv } from '../env';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const FEE_GATE_ABI = [
  {
    type: 'function',
    name: 'issuerNonce',
    stateMutability: 'view',
    inputs: [{ name: 'issuer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'attestCount',
    stateMutability: 'view',
    inputs: [{ name: 'issuer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'hasPaidFee',
    stateMutability: 'view',
    inputs: [{ name: 'issuer', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'FEE_THRESHOLD',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'LIFETIME_FEE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'attestDelegated',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'payload',
        type: 'tuple',
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'refUID', type: 'bytes32' },
          { name: 'revocable', type: 'bool' },
          { name: 'expirationTime', type: 'uint64' },
          { name: 'cubidId', type: 'string' },
          { name: 'trustLevel', type: 'uint8' },
          { name: 'human', type: 'bool' },
          { name: 'circle', type: 'bytes32' },
          { name: 'issuedAt', type: 'uint64' },
          { name: 'expiry', type: 'uint64' },
        ],
      },
      { name: 'issuer', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
      {
        name: 'signature',
        type: 'tuple',
        components: [
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

let cachedPublicClient: PublicClient | null = null;

function getPublicClientInstance(): PublicClient {
  if (cachedPublicClient) {
    return cachedPublicClient;
  }

  const { rpcUrl } = getEnv();
  if (!rpcUrl) {
    throw new Error('MOONBEAM_RPC is not configured');
  }

  cachedPublicClient = createPublicClient({
    chain: moonbeam,
    transport: http(rpcUrl),
  });

  return cachedPublicClient;
}

let cachedWalletClient: ReturnType<typeof createWalletClient> | null = null;

type WalletClientType = ReturnType<typeof createWalletClient>;

function getWalletClientInstance(): WalletClientType {
  if (cachedWalletClient) {
    return cachedWalletClient;
  }

  const { rpcUrl, relayerPrivateKey } = getEnv();
  if (!rpcUrl) {
    throw new Error('MOONBEAM_RPC is not configured');
  }

  if (!relayerPrivateKey) {
    throw new Error('PRIVATE_KEY_RELAYER is not configured');
  }

  const account = privateKeyToAccount(relayerPrivateKey);

  cachedWalletClient = createWalletClient({
    account,
    chain: moonbeam,
    transport: http(rpcUrl),
  });

  return cachedWalletClient;
}

function assertFeeGateAddress(address: string): asserts address is `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address) || address.toLowerCase() === ZERO_ADDRESS) {
    throw new Error('FEEGATE_ADDR is not configured');
  }
}

export interface PrepareContext {
  chainId: number;
  nonce: bigint;
  attestCount: bigint;
  hasPaidFee: boolean;
  feeThreshold: bigint;
  lifetimeFee: bigint;
}

export async function fetchPrepareContext(issuer: `0x${string}`): Promise<PrepareContext> {
  const env = getEnv();
  assertFeeGateAddress(env.feeGateAddress);

  const client = getPublicClientInstance();

  const [chainId, nonce, attestCount, hasPaidFee, feeThreshold, lifetimeFee] = await Promise.all([
    client.getChainId(),
    client.readContract({
      address: env.feeGateAddress,
      abi: FEE_GATE_ABI,
      functionName: 'issuerNonce',
      args: [issuer],
    }) as Promise<bigint>,
    client.readContract({
      address: env.feeGateAddress,
      abi: FEE_GATE_ABI,
      functionName: 'attestCount',
      args: [issuer],
    }) as Promise<bigint>,
    client.readContract({
      address: env.feeGateAddress,
      abi: FEE_GATE_ABI,
      functionName: 'hasPaidFee',
      args: [issuer],
    }) as Promise<boolean>,
    client.readContract({
      address: env.feeGateAddress,
      abi: FEE_GATE_ABI,
      functionName: 'FEE_THRESHOLD',
    }) as Promise<bigint>,
    client.readContract({
      address: env.feeGateAddress,
      abi: FEE_GATE_ABI,
      functionName: 'LIFETIME_FEE',
    }) as Promise<bigint>,
  ]);

  return {
    chainId,
    nonce,
    attestCount,
    hasPaidFee,
    feeThreshold,
    lifetimeFee,
  };
}

export interface RelayPayload {
  recipient: `0x${string}`;
  refUID?: `0x${string}`;
  revocable: boolean;
  expirationTime: bigint;
  cubidId: string;
  trustLevel: number;
  human: boolean;
  circle: `0x${string}`;
  issuedAt: bigint;
  expiry: bigint;
}

export interface RelayArgs {
  issuer: `0x${string}`;
  payload: RelayPayload;
  nonce: bigint;
  deadline: bigint;
  signature: `0x${string}`;
  value: bigint;
}

export interface RelayResult {
  hash: `0x${string}`;
  receipt: TransactionReceipt;
}

export async function relayDelegatedAttestation(args: RelayArgs): Promise<RelayResult> {
  const env = getEnv();
  assertFeeGateAddress(env.feeGateAddress);

  const walletClient = getWalletClientInstance();
  const publicClient = getPublicClientInstance();

  const { r, s, v } = signatureToVRS(args.signature);

  const hash = await walletClient.writeContract({
    address: env.feeGateAddress,
    abi: FEE_GATE_ABI,
    functionName: 'attestDelegated',
    args: [
      {
        recipient: args.payload.recipient,
        refUID: args.payload.refUID ?? ZERO_BYTES32,
        revocable: args.payload.revocable,
        expirationTime: args.payload.expirationTime,
        cubidId: args.payload.cubidId,
        trustLevel: args.payload.trustLevel,
        human: args.payload.human,
        circle: args.payload.circle,
        issuedAt: args.payload.issuedAt,
        expiry: args.payload.expiry,
      },
      args.issuer,
      args.nonce,
      args.deadline,
      { r, s, v },
    ],
    value: args.value,
    account: walletClient.account!,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return { hash, receipt };
}

export function resetFeeGateClients(): void {
  cachedPublicClient = null;
  cachedWalletClient = null;
}

export const __testing = {
  ZERO_BYTES32,
};

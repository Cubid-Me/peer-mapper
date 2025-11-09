/* eslint-disable import/first */

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/feeGate', () => ({
  fetchPrepareContext: vi.fn(),
  relayDelegatedAttestation: vi.fn(),
}));

import { buildApp } from '../src/api';
import { refreshEnv } from '../src/env';
import { fetchPrepareContext, relayDelegatedAttestation } from '../src/services/feeGate';

const mockedFetchPrepareContext = vi.mocked(fetchPrepareContext);
const mockedRelayDelegatedAttestation = vi.mocked(relayDelegatedAttestation);

const FEEGATE_ADDR = '0x1111111111111111111111111111111111111111';
const RPC_URL = 'http://localhost:8545';

describe('Attestation submission routes', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:';
    process.env.FEEGATE_ADDR = FEEGATE_ADDR;
    process.env.MOONBEAM_RPC = RPC_URL;
    process.env.REGISTRY_ADDR = '0x2222222222222222222222222222222222222222';
    process.env.EAS_ADDR = '0x3333333333333333333333333333333333333333';
    process.env.SCHEMA_UID =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    refreshEnv();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('returns typed data and fee metadata from /attest/prepare', async () => {
    mockedFetchPrepareContext.mockResolvedValue({
      chainId: 1284,
      nonce: 1n,
      attestCount: 2n,
      hasPaidFee: false,
      feeThreshold: 3n,
      lifetimeFee: 100n,
    });

    const app = buildApp();
    const response = await request(app)
      .post('/attest/prepare')
      .send({
        issuer: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        recipient: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        cubidId: 'friend-123',
        trustLevel: 5,
        human: true,
        circle: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        issuedAt: 1_700_000_000,
        expiry: 0,
      })
      .expect(200);

    expect(mockedFetchPrepareContext).toHaveBeenCalledWith(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    expect(response.body.typedData.domain).toEqual({
      name: 'FeeGate',
      version: '1',
      chainId: 1284,
      verifyingContract: FEEGATE_ADDR,
    });
    expect(response.body.typedData.message).toMatchObject({
      issuer: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      recipient: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      cubidId: 'friend-123',
      trustLevel: 5,
      human: true,
      circle: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      nonce: '1',
    });
    expect(typeof response.body.typedData.message.deadline).toBe('number');
    expect(response.body.meta).toEqual({
      nonce: '1',
      nextCount: '3',
      fee: { required: true, amount: '100' },
    });
  });

  it('relays delegated attestations and returns transaction info', async () => {
    mockedRelayDelegatedAttestation.mockResolvedValue({
      hash: '0x' + 'f'.repeat(64),
      receipt: {
        blockHash: '0x' + '0'.repeat(64),
        blockNumber: 123n,
        contractAddress: null,
        cumulativeGasUsed: 0n,
        effectiveGasPrice: 0n,
        from: '0xdddddddddddddddddddddddddddddddddddddddd',
        gasUsed: 456n,
        logs: [],
        logsBloom: '0x' + '0'.repeat(512),
        root: undefined,
        status: 'success',
        to: FEEGATE_ADDR,
        transactionHash: '0x' + 'f'.repeat(64),
        transactionIndex: 0,
        type: '0x2',
      },
    });

    const app = buildApp();
    const response = await request(app)
      .post('/attest/relay')
      .send({
        issuer: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        signature: '0x' + '1'.repeat(130),
        value: '250',
        payload: {
          recipient: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          cubidId: 'friend-123',
          trustLevel: 5,
          human: true,
          circle: '0x' + 'c'.repeat(64),
          issuedAt: 1_700_000_000,
          expiry: 0,
          refUID: '0x' + 'd'.repeat(64),
          revocable: true,
          expirationTime: 0,
          nonce: '4',
          deadline: 1_700_000_300,
        },
      })
      .expect(202);

    expect(mockedRelayDelegatedAttestation).toHaveBeenCalledWith({
      issuer: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      payload: {
        recipient: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        refUID: ('0x' + 'd'.repeat(64)) as `0x${string}`,
        revocable: true,
        expirationTime: 0n,
        cubidId: 'friend-123',
        trustLevel: 5,
        human: true,
        circle: ('0x' + 'c'.repeat(64)) as `0x${string}`,
        issuedAt: 1_700_000_000n,
        expiry: 0n,
      },
      nonce: 4n,
      deadline: 1_700_000_300n,
      signature: ('0x' + '1'.repeat(130)) as `0x${string}`,
      value: 250n,
    });

    expect(response.body).toEqual({
      txHash: '0x' + 'f'.repeat(64),
      status: 'success',
      blockNumber: '123',
      gasUsed: '456',
    });
  });

  it('rejects invalid payloads with 400', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/attest/prepare')
      .send({ issuer: 'invalid' })
      .expect(400);

    expect(response.body.error).toBe('invalid_request');
    expect(mockedFetchPrepareContext).not.toHaveBeenCalled();
  });
});

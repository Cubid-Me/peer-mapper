/* eslint-disable simple-import-sort/imports */
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { ZodError, z } from 'zod';

import { getEnv } from '../env';
import { fetchPrepareContext, relayDelegatedAttestation } from '../services/feeGate';
import { buildTypedData } from '../services/typedData';

const FIVE_MINUTES = 5 * 60;
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => value.toLowerCase() as `0x${string}`);

const bytes32Schema = z
  .string()
  .regex(/^0x([0-9a-fA-F]{64})?$/)
  .transform((value) => {
    // Only two cases are possible due to the regex: '0x' or 66-char bytes32
    return value === '0x'
      ? ZERO_BYTES32 as `0x${string}`
      : value.toLowerCase() as `0x${string}`;
  });

const prepareSchema = z.object({
  issuer: addressSchema,
  recipient: addressSchema,
  cubidId: z.string().trim().min(1),
  trustLevel: z.coerce.number().int().min(0).max(255),
  human: z.boolean(),
  circle: bytes32Schema.optional(),
  issuedAt: z.coerce.number().int().nonnegative().optional(),
  expiry: z.coerce.number().int().nonnegative().optional(),
  refUID: bytes32Schema.optional(),
  revocable: z.boolean().optional(),
  expirationTime: z.coerce.number().int().nonnegative().optional(),
});

const signatureSchema = z.string().regex(/^0x[0-9a-fA-F]{130}$/);

const relaySchema = z.object({
  issuer: addressSchema,
  signature: signatureSchema,
  value: z
    .union([z.bigint(), z.coerce.number(), z.string().regex(/^\d+$/)])
    .optional()
    .transform((val) => {
      if (val === undefined) {
        return 0n;
      }
      if (typeof val === 'bigint') {
        return val;
      }
      if (typeof val === 'number') {
        return BigInt(val);
      }
      return BigInt(val);
    }),
  payload: z.object({
    recipient: addressSchema,
    refUID: bytes32Schema.optional(),
    revocable: z.boolean().optional(),
    expirationTime: z.coerce.number().int().nonnegative().optional(),
    cubidId: z.string().trim().min(1),
    trustLevel: z.coerce.number().int().min(0).max(255),
    human: z.boolean(),
    circle: bytes32Schema.optional(),
    issuedAt: z.coerce.number().int().nonnegative(),
    expiry: z.coerce.number().int().nonnegative(),
    nonce: z.union([z.bigint(), z.coerce.number(), z.string().regex(/^\d+$/)]),
    deadline: z.coerce.number().int().nonnegative(),
  }),
});

function handleValidationError(error: ZodError, res: Response) {
  res.status(400).json({
    error: 'invalid_request',
    details: error.flatten(),
  });
}

const router = Router();

router.post('/prepare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = prepareSchema.parse(req.body);
    const env = getEnv();
    const context = await fetchPrepareContext(input.issuer);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const deadline = nowSeconds + FIVE_MINUTES;

    const message = {
      issuer: input.issuer,
      recipient: input.recipient,
      refUID: (input.refUID ?? ZERO_BYTES32) as `0x${string}`,
      revocable: input.revocable ?? true,
      expirationTime: input.expirationTime ?? 0,
      cubidId: input.cubidId,
      trustLevel: Number(input.trustLevel),
      human: input.human,
      circle: (input.circle ?? ZERO_BYTES32) as `0x${string}`,
      issuedAt: input.issuedAt ?? nowSeconds,
      expiry: input.expiry ?? 0,
      nonce: context.nonce.toString(),
      deadline,
    };

    const domain = {
      name: 'FeeGate',
      version: '1',
      chainId: context.chainId,
      verifyingContract: env.feeGateAddress as `0x${string}`,
    };

    const typedData = buildTypedData(domain, message);

    const nextCount = context.attestCount + 1n;
    const feeRequired = !context.hasPaidFee && nextCount === context.feeThreshold;
    const feeAmount = feeRequired ? context.lifetimeFee : 0n;

    res.json({
      typedData,
      meta: {
        nonce: context.nonce.toString(),
        nextCount: nextCount.toString(),
        fee: {
          required: feeRequired,
          amount: feeAmount.toString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      handleValidationError(error, res);
      return;
    }
    next(error);
  }
});

router.post('/relay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = relaySchema.parse(req.body);

    const payload = {
      recipient: input.payload.recipient,
      refUID: (input.payload.refUID ?? ZERO_BYTES32) as `0x${string}`,
      revocable: input.payload.revocable ?? true,
      expirationTime: BigInt(input.payload.expirationTime ?? 0),
      cubidId: input.payload.cubidId,
      trustLevel: Number(input.payload.trustLevel),
      human: input.payload.human,
      circle: (input.payload.circle ?? ZERO_BYTES32) as `0x${string}`,
      issuedAt: BigInt(input.payload.issuedAt),
      expiry: BigInt(input.payload.expiry),
    };

    const nonce =
      typeof input.payload.nonce === 'bigint'
        ? input.payload.nonce
        : BigInt(input.payload.nonce as number | string);

    const deadline = BigInt(input.payload.deadline);

    const result = await relayDelegatedAttestation({
      issuer: input.issuer,
      payload,
      nonce,
      deadline,
      signature: input.signature as `0x${string}`,
      value: input.value ?? 0n,
    });

    res.status(202).json({
      txHash: result.hash,
      status: result.receipt.status,
      blockNumber: result.receipt.blockNumber?.toString(),
      gasUsed: result.receipt.gasUsed?.toString(),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      handleValidationError(error, res);
      return;
    }
    next(error);
  }
});

export default router;

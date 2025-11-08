import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default(':memory:'),
  REGISTRY_ADDR: z.string().min(1).default('0x0'),
  EAS_ADDR: z.string().min(1).default('0x0'),
  SCHEMA_UID: z.string().min(1).default('0x0'),
  FEEGATE_ADDR: z.string().min(1).default('0x0'),
  MOONBEAM_RPC: z.string().min(1).optional(),
  RATE_LIMIT_RPS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_DAILY: z.coerce.number().int().positive().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const values = parsed.data;

export const env = {
  databaseUrl: values.DATABASE_URL,
  registryAddress: values.REGISTRY_ADDR,
  easAddress: values.EAS_ADDR,
  schemaUid: values.SCHEMA_UID,
  feeGateAddress: values.FEEGATE_ADDR,
  rpcUrl: values.MOONBEAM_RPC,
  rateLimitPerSecond: values.RATE_LIMIT_RPS ?? 2,
  rateLimitDaily: values.RATE_LIMIT_DAILY ?? 100,
};

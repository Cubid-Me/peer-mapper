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
  PRIVATE_KEY_RELAYER: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
  RATE_LIMIT_RPS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_DAILY: z.coerce.number().int().positive().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
});

export type EnvValues = {
  databaseUrl: string;
  registryAddress: string;
  easAddress: string;
  schemaUid: string;
  feeGateAddress: string;
  rpcUrl?: string;
  relayerPrivateKey?: `0x${string}`;
  rateLimitPerSecond: number;
  rateLimitDaily: number;
  supabase: {
    url?: string;
    serviceRoleKey?: string;
    jwtSecret?: string;
  };
};

let cache: EnvValues | null = null;

function parseEnv(): EnvValues {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  const values = parsed.data;

  return {
    databaseUrl: values.DATABASE_URL,
    registryAddress: values.REGISTRY_ADDR,
    easAddress: values.EAS_ADDR,
    schemaUid: values.SCHEMA_UID,
    feeGateAddress: values.FEEGATE_ADDR,
    rpcUrl: values.MOONBEAM_RPC,
    relayerPrivateKey: values.PRIVATE_KEY_RELAYER as `0x${string}` | undefined,
    rateLimitPerSecond: values.RATE_LIMIT_RPS ?? 2,
    rateLimitDaily: values.RATE_LIMIT_DAILY ?? 100,
    supabase: {
      url: values.SUPABASE_URL,
      serviceRoleKey: values.SUPABASE_SERVICE_ROLE_KEY,
      jwtSecret: values.SUPABASE_JWT_SECRET,
    },
  };
}

export function getEnv(): EnvValues {
  if (!cache) {
    cache = parseEnv();
  }
  return cache;
}

export function refreshEnv(): EnvValues {
  cache = parseEnv();
  return cache;
}

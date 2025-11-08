import * as dotenv from 'dotenv';

dotenv.config();

const required = [
  'DATABASE_URL',
  'REGISTRY_ADDR',
  'EAS_ADDR',
  'SCHEMA_UID',
  'FEEGATE_ADDR',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  registryAddress: process.env.REGISTRY_ADDR!,
  easAddress: process.env.EAS_ADDR!,
  schemaUid: process.env.SCHEMA_UID!,
  feeGateAddress: process.env.FEEGATE_ADDR!,
  rateLimitPerSecond: Number(process.env.RATE_LIMIT_RPS ?? 2),
  rateLimitDaily: Number(process.env.RATE_LIMIT_DAILY ?? 100),
};

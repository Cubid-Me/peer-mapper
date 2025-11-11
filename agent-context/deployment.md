# Deployment & Operations Playbook

This playbook captures the end-to-end steps for publishing the peer-mapper stack once contracts, indexer, and frontend are ready. Session 09 focuses on making deployment repeatable rather than broadcasting from the container.

## 1. Pre-flight Checklist

1. Ensure `pnpm-lock.yaml` is committed (generated via `pnpm install`).
2. Export the required secrets into your shell (never commit real values):
   - `MOONBEAM_RPC`, `PRIVATE_KEY_DEPLOYER`, `PRIVATE_KEY_RELAYER`
   - `SUPABASE_*` keys from the production project
   - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   - `FLY_API_TOKEN` (or Render token if using Render)
3. Confirm Supabase has the production identity tables (`public.profiles`, `public.profile_credentials`, `public.profiles_cubid`) plus the helper RPC and RLS policies applied.
4. Update `addresses.json` with the last-known deployment artefacts after each broadcast.
5. Run the full quality gate locally:
   ```bash
   pnpm lint
   pnpm --filter frontend build
   pnpm --filter indexer build
   pnpm --filter frontend test
   pnpm --filter indexer test
   pnpm test
   ```

## 2. Contract Deployment (Moonbeam)

> Uses Foundry scripts under `contracts/script/`.

1. Configure the deployer key:
   ```bash
   export MOONBEAM_RPC=https://rpc.api.moonbeam.network
   export PRIVATE_KEY_DEPLOYER=0x...
   export PRIVATE_KEY_RELAYER=0x...
   ```
2. Deploy SchemaRegistry + EAS:
   ```bash
   cd contracts
   forge script script/DeployEAS.s.sol \
     --rpc-url "$MOONBEAM_RPC" \
     --broadcast \
     --verify \
     --etherscan-api-key "$MOONSCAN_API_KEY"
   ```
3. Register the CubidTrust schema against the deployed registry:
   ```bash
   forge script script/RegisterSchema.s.sol \
     --rpc-url "$MOONBEAM_RPC" \
     --broadcast
   ```
4. Deploy FeeGate with the resulting addresses and schema UID. Example:
   ```bash
   forge script script/DeployFeeGate.s.sol \
     --rpc-url "$MOONBEAM_RPC" \
     --broadcast \
     --verify \
     --etherscan-api-key "$MOONSCAN_API_KEY"
   ```
5. Capture the contract addresses, schema UID, and transaction hashes into `addresses.json` and `agent-context/eas-addresses.md`.

### 2.1 Moonscan Verification Links

Moonscan verification happens automatically when `--verify` + `--etherscan-api-key` are provided. Record the permalink to each contract:

- SchemaRegistry: `https://moonscan.io/address/<address>#code`
- EAS: `https://moonscan.io/address/<address>#code`
- FeeGate: `https://moonscan.io/address/<address>#code`

## 3. Indexer Deployment (Fly.io example)

1. Build the production image (Dockerfile already present under `indexer/`):
   ```bash
   pnpm --filter indexer build
   docker build -f indexer/Dockerfile -t peer-mapper-indexer:latest .
   ```
2. Authenticate with Fly:
   ```bash
   fly auth token
   export FLY_API_TOKEN=...
   ```
3. Create the app:
   ```bash
   fly apps create peer-mapper-indexer
   ```
4. Provision a persistent volume or external Postgres (SQLite is default). For Postgres:
   ```bash
   fly postgres create --name peer-mapper-db --initial-cluster-size 1
   ```
   Set `DATABASE_URL` to the connection string.
5. Deploy:
   ```bash
   fly deploy --dockerfile indexer/Dockerfile --build-arg PNPM_VERSION=10.18.3
   ```
6. Configure secrets (one per environment variable):
   ```bash
   fly secrets set \
     DATABASE_URL=postgres://... \
     MOONBEAM_RPC=... \
     PRIVATE_KEY_RELAYER=... \
     REGISTRY_ADDR=0x... \
     EAS_ADDR=0x... \
     SCHEMA_UID=0x... \
     FEEGATE_ADDR=0x... \
     SUPABASE_URL=https://... \
     SUPABASE_SERVICE_ROLE_KEY=... \
     SUPABASE_JWT_SECRET=...
   ```
7. Validate health by curling `/healthz` (Express route exported in `src/api.ts`). Record the public URL in the session log.

_Alternative:_ Render can follow the same Dockerfile. Configure environment variables in the Render dashboard and enable auto-deploy from `main`.

## 4. Frontend Deployment (Vercel)

1. Create a new Vercel project pointing to `frontend/`.
2. Configure build & dev commands:
   - **Build Command:** `pnpm --filter frontend build`
   - **Install Command:** `pnpm install`
   - **Output Directory:** `.next`
3. Add environment variables for both Production and Preview:
   - `NEXT_PUBLIC_INDEXER_URL=https://peer-mapper-indexer.fly.dev`
   - `NEXT_PUBLIC_EAS_ADDR=0x...`
   - `NEXT_PUBLIC_FEEGATE_ADDR=0x...`
   - `NEXT_PUBLIC_SCHEMA_UID=0x...`
   - `NEXT_PUBLIC_CHAIN_ID=1284`
   - `NEXT_PUBLIC_SUPABASE_URL=https://...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
4. Configure the Supabase redirect URL to include the Vercel domain.
5. Promote the initial deployment to production once smoke-tested.

## 5. Release Management

- Tag contract deployments (`git tag contracts-v1`) when addresses change. Update `addresses.json` history.
- For coordinated releases, create a GitHub release noting:
  - Contract versions + Moonscan links
  - Indexer deployment URL and build timestamp
  - Frontend Vercel deployment ID
- Each production release should attach the output of `pnpm test`, `pnpm lint`, and `pnpm --filter frontend build`.

## 6. Observability & Rollback

- **Indexer:** enable Fly logs (`fly logs -a peer-mapper-indexer`). Add uptime checks (e.g., Better Stack) hitting `/healthz` every minute.
- **Frontend:** rely on Vercel analytics for build health. Configure a preview protection password if needed.
- **Contracts:** monitor Moonscan events or integrate Tenderly simulation for FeeGate.
- Rollback steps:
  - Frontend: promote a previous Vercel deployment.
  - Indexer: `fly deploy --image <previous image>`.
  - Contracts: redeploy new FeeGate version and update addresses (irreversible, so guard carefully).

## 7. Artefact Recording

After each deploy, update:

- `agent-context/eas-addresses.md`
- `addresses.json`
- `agent-context/session-log.md`
- `agent-context/session-logs/session-XX.md`

Include URLs, block numbers, and verification links to preserve provenance.

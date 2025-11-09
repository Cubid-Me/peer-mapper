# Peer Mapper Monorepo

Hackathon-scale stack for Cubid-powered trust attestations on Moonbeam. This repository contains three workspaces:

- `contracts/` – Foundry project with EAS + FeeGate contracts.
- `indexer/` – Express/TypeScript indexer + API scaffold.
- `frontend/` – Next.js 15 (App Router) demo UI with Tailwind v4.

All tooling is pinned via `tool-versions.md`, Husky, ESLint/Prettier, and Solhint run from the repo root.

---

## Getting Started

```bash
pnpm install          # installs workspace dependencies
pnpm lint             # eslint + solhint
pnpm -r test          # runs workspace test scripts (vitest + future forge tests)
pnpm --filter contracts forge build
pnpm --filter indexer dev
pnpm --filter frontend dev
```

### Install Foundry (forge)

This project uses Foundry for Solidity compilation and tests. Install Foundry with the official installer:

```bash
curl -L https://foundry.paradigm.xyz | bash
# then either open a new shell, or source the updated shell file:
source ~/.zshenv   # or source ~/.bashrc depending on your shell
foundryup          # install/upgrade forge, cast, anvil
```

Notes:

- On macOS you may need libusb for some components: `brew install libusb`.
- If you see a message about updating your shell PATH, follow it and open a new terminal.

Verify installation:

```bash
forge --version
cast --version
anvil --version
```

To compile and run the Solidity tests locally:

```bash
cd contracts
forge build
forge test -vv
```

### Directory Structure

```
contracts/            Foundry sources, scripts, tests, vendored EAS & OZ submodules
frontend/             Next.js app with app router routes + shared libs/components
indexer/              Node/TS service (Express), schema.sql, Dockerfile, tests
agent-context/        Specs, instructions, logs (see session-logs for history)
.husky/               Pre-commit hook (lint-staged)
tool-versions.md      Node/pnpm/Foundry versions
```

### Environment Variables

| Location | File                    | Keys                                                                                                                            |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Root     | `.env.example`          | `MOONBEAM_RPC`, `PRIVATE_KEY_RELAYER`                                                                                           |
| Indexer  | `indexer/.env.example`  | `DATABASE_URL`, `REGISTRY_ADDR`, `EAS_ADDR`, `SCHEMA_UID`, `FEEGATE_ADDR`, `RATE_LIMIT_RPS`, `RATE_LIMIT_DAILY`                 |
| Frontend | `frontend/.env.example` | `NEXT_PUBLIC_EAS_ADDR`, `NEXT_PUBLIC_FEEGATE_ADDR`, `NEXT_PUBLIC_SCHEMA_UID`, `NEXT_PUBLIC_INDEXER_URL`, `NEXT_PUBLIC_CHAIN_ID` |

No secrets should be committed—copy the relevant `.env.example` into `.env` locally.

---

## Development Notes

- **Tooling**: Node v22.21.0, pnpm 10.18.3, Foundry v1.4.3 (see `tool-versions.md`).
- **Linting**: `pnpm lint` (TS + Solidity) and `pnpm format`.
- **Testing**: Workspace scripts (`vitest` today, forge tests added from Session 2 onward).
- **Git hooks**: Husky + lint-staged ensure staged files pass lint/format before commit.

For detailed specs and the multi-session delivery plan, read `agent-context/technical-spec.md` and `agent-context/agent-instructions.md`.

---
description: Authoritative guide for all software-writing agents in this repository
alwaysApply: true
---

# AGENTS.md  
---

## 0 Philosophy

| Principle | Meaning for agents |
|-----------|-------------------|
| **Data before UI** | Treat database schema, migrations, and existing rows as sacred: can be updated, but carefully and structured. |
| **Small, safe steps** | Every session past v1 is a micro-iteration with its own log, spec delta, and reflection. |
| **Design, then develop** | Every session both amends the design specs and implements the changes into code. |
| **Canadian English** | House style for all prose and code. |
| **Security first** | No plaintext secrets; use environment variables referenced by pattern in `.env.example`. |
| **Test a lot** | Configure solidity-coverage and integration tests to catch bugs early. Use CI workflows to run tests on every pull request. Foundry’s forge coverage is wired via scripts/forge-coverage.sh; keep ≥ 90 % line coverage. |

---

## 1 Repository structure
This repository follows a monorepo layout. The canonical, target structure for this project (what agents should aim to establish) is documented in `agent-context/agent-instructions.md` and in the per-session instructions. At a high level, the expected top-level folders are:

- `contracts/`   — Solidity sources and Foundry project (contracts, scripts, tests)
- `indexer/`     — Node/TypeScript indexer service (listeners, API, DB schema)
- `frontend/`    — Next.js application and UI components
- `agent-context/` — design artifacts, session logs and operational docs for agents
- `.github/`     — CI workflows and PR templates
- `scripts/`     — helper scripts (env-sync, coverage, etc.)

The repository may start as a small seed (only a subset of these folders present). The `agent-context/agent-instructions.md` file contains a full target directory map and a 10-session plan that agents should follow to reach the target layout. Agents must not contradict that plan when making incremental changes — instead, use `agent-instructions.md` as the authoritative target and update `AGENTS.md` if the project-level conventions change.

Minimal files and directories agents should expect or create early in a bootstrap session:

```
.github/workflows/       # CI workflows (lint, tests, coverage)
agent-context/           # designs, logs and other context files for developers and agents
  ├─ session-log.md      # Mandatory – append-only per session, new entries at top of file
  ├─ technical-spec.md   # Mandatory – latest technical spec
  ├─ workflow.md         # Mandatory – per-session checklist
contracts/               # solidity contracts, foundry (when present)
indexer/                 # blockchain indexer (when present)
frontend/                # web app (when present)
components/              # shared components (frontend)
hooks/                   # custom React hooks (frontend)
lib/                     # shared libraries and vendored contracts
public/                  # static assets to be served
scripts/                 # helper scripts (env-sync, spec-lint, coverage)
styles/                  # global styles (frontend)
supabase/                # latest sql schema (github action runs db pull on PR)
test/                    # test helpers and integration tests
README.md                # intro to the project and this repo
AGENTS.md                # this file
agent-setup.md           # One-time boot-strap guide for agents
```

*Note: If any mandatory files under `.github/workflows/` or `agent-context/` are missing, agents should follow the bootstrap steps in `agent-context/agent-setup.md` (or the canonical upstream referenced there) to create them.*

---

## 2 Coding Conventions

* **Framework & Versions**
  * Nextjs v15.3
  * Nodejs v24
  * Foundry (forge + cast) & Hardhat for coverage; Solidity ^0.8.30
* **Structure**
  * Add or modify files within the structure above if possible.
  * If you need to add folders then also update both AGENTS.md (this file) and README.md folder diagrams.
* **Lint / Format**  
  * **TypeScript** → ESLint + Prettier  
  * **Solidity**   → `solhint` (or `solidity-lint`) + Prettier plugin  
  * `pnpm lint` runs **both** (`pnpm lint:ts && pnpm lint:sol`)
* **Tabs / Indent**
  * Four spaces in solidity, two spaces in typescript (no hard tabs)  
* **Env handling**
  * Update `.env.example` with *names* of new vars (never values).
  * Boolean flags must be 'true'/'false' strings to avoid docker‑compose parsing quirks. 
* **Secrets scan**
  * Detect hard-coded keys and secrets → Refactor to env vars + update `.env.example` + note in session log need for adding new env var
  * Add logs where needed, but ensure no sensitive values (tokens, IDs, secrets) are logged even in dev mode.  
  * Run trufflehog on diff in CI workflow and full scan in nightly workflow
* **Testing**
  * If any new logic →  Always add or modify unit tests accordingly.  
  * Jest / Vitest for JavaScript units
  * Foundry for Solidity (if present)
  * Cypress for front-end e2e (if present).
* **Pull Requests**
  * Keep pull request descriptions short, following [conventionalcommits](https://www.conventionalcommits.org/en/v1.0.0/)
  * If any related issues are known, mention them in PR (e.g. "Isses: #10, #11")
* **Session version tags**
  * Follow SemVer (v2.0.0-alpha)
  * Major IDs ("v1.0", "v2.0") mirror new feature branches
  * Minor IDs ("v2.0", "v2.1") mirror different coding sesssions on the same feature branch

---

## 3 Process Overview

| Phase | File | Detail |
|-------|------|--------|
| **Bootstrap (first run)** | `https://raw.githubusercontent.com/KazanderDad/agent-context-seed-files/refs/heads/main/agent-setup.md` | Creates folders, Husky hooks, CI scaffold, etc. Installs git-moji-cli for commit emojis (optional). |
| **Every session** | `workflow.md` | Mandatory checklist (log, spec update(s), code, summary). |
| **Artefact maintenance** | Scripts inside `scripts/` | `env-sync.ts`, `spec-lint.ts`, etc. |
| **CI Triggers** | Pushes to main and all PRs run forge test, forge coverage, pnpm lint, and hardhat size-contracts. |

Agents **must** read [agent-setup.md](https://raw.githubusercontent.com/KazanderDad/agent-context-seed-files/refs/heads/main/agent-setup.md) if artefacts are missing, otherwise follow `workflow.md` each time.

---

## 4 Guard-rails

* SQL migrations must be **idempotent & reversible** (include -- DOWN section which must revert exactly to previous schema; each DROP/ALTER should be preceded by IF EXISTS/IF NOT EXISTS..).
* Pre-commit hook **warns** (not blocks) if ESLint and similar (e.g. in Foundry) cannot start.
* Session log must bump version +1 for each session
* All new external calls must use SafeERC20 / Address.functionCall and be covered in tests.
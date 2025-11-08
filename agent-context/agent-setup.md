# agent-setup.md

This is a local copy of the canonical bootstrap instructions. Agents should follow this file when the `agent-context/` folder or its mandatory files are missing.

See upstream: https://raw.githubusercontent.com/KazanderDad/agent-context-seed-files/refs/heads/main/agent-setup.md

Summary of key steps performed by this bootstrap:

- Create mandatory `agent-context/` files (session-log.md, technical-spec.md, workflow.md)
- Create `.env.example` with placeholder keys
- Add minimal GitHub Actions CI workflow at `.github/workflows/ci.yml`
- Add a PR template at `.github/PULL_REQUEST_TEMPLATE.md`
- Add helper scripts under `scripts/` (placeholders)
- Add a minimal Foundry example test at `contracts/evm/test/Example.t.sol`

This local copy is sufficient for the agent to know what files to create locally. For the full canonical source, see the upstream URL above.

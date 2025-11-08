# workflow.md

This file contains the mandatory per-session checklist agents must follow.

1. Read `AGENTS.md` and `agent-setup.md`.
2. Update `session-log.md` (append new session at top and bump session version).
3. Update `technical-spec.md` and `functional-spec.md` as work proceeds.
4. Make small, safe changes and add tests.
5. Run `pnpm env:sync` and `pnpm spec:lint` if present. Commit with `chore(setup): bootstrap agent tooling` for initial bootstrap.

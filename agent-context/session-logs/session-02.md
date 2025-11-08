# Session 02 — Deploy EAS Core & Register CubidTrust

## Goals

- Stand up Foundry scripts to deploy SchemaRegistry and EAS.
- Provide a repeatable schema registration path for CubidTrust.
- Capture env placeholders and doc updates for future sessions.

## Actions Performed

- Created `DeployEAS.s.sol` and `RegisterSchema.s.sol` scripts for end-to-end contract deployment and schema registration.
- Added Foundry tests covering contract instantiation and schema registry behaviour, removing placeholder counter scaffolding.
- Expanded `.env.example` with deployer/signing variables and documented address recording workflow in the technical spec.

## Commands & Outputs (highlights)

- `git submodule update --init --recursive`
- `forge build`
- `forge test`

## Artifacts

- contracts/script/DeployEAS.s.sol
- contracts/script/RegisterSchema.s.sol
- contracts/test/EASDeploy.t.sol
- contracts/test/SchemaReg.t.sol
- agent-context/eas-addresses.md

## Tests

- `forge build`
- `forge test`

## Issues/Risks

- FeeGate resolver address is a placeholder until Session 3; schema registered with `address(0)` resolver should be updated post-deployment.

## Next Session Entry Criteria

- Implement FeeGate resolver contract and integrate schema resolver address once deployed.

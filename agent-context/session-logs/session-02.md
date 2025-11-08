# Session 02 — Deploy EAS Core & Register CubidTrust

## Goals

- Stand up Foundry scripts to deploy SchemaRegistry and EAS
- Provide a repeatable schema registration path for CubidTrust
- Implement FeeGate resolver with nonce validation and fee charging logic
- Capture env placeholders and doc updates for future sessions

## Actions Performed

### Initial Setup (from previous incomplete session)

- Created `DeployEAS.s.sol` and `RegisterSchema.s.sol` scripts for end-to-end contract deployment and schema registration
- Added Foundry tests covering contract instantiation and schema registry behavior

### Compilation Fixes

- **Fixed OpenZeppelin remapping**: Changed `foundry.toml` remapping from `"@openzeppelin/=lib/openzeppelin/contracts/"` to `"@openzeppelin/contracts/=lib/openzeppelin/contracts/"` (was duplicating `/contracts/` in resolved paths)
- **Updated EVM version**: Changed `evm_version` from `"paris"` to `"cancun"` in `foundry.toml` to support OpenZeppelin v5.x mcopy instruction
- **Fixed test imports**: Updated `SchemaReg.t.sol` to import `SchemaRecord` separately from `ISchemaRegistry` (struct defined at file scope)
- **Fixed error selector references**: Changed `vm.expectRevert(ISchemaRegistry.AlreadyExists.selector)` to `SchemaRegistry.AlreadyExists.selector` (error defined in implementation, not interface)

### FeeGate Implementation

- **Created `FeeGate.sol`** (contracts/src/FeeGate.sol):
  - Implements `ISchemaResolver` interface for EAS attestation validation
  - Per-issuer nonce tracking (`issuerNonce` mapping) for replay protection
  - Attestation counting (`attestCount` mapping)
  - One-time 100 GLMR fee on 3rd attestation (`LIFETIME_FEE` constant, `FEE_THRESHOLD = 3`)
  - Last-UID anchoring (`lastUID` mapping) for latest-wins determinism
  - Helper functions: `_extractCubidId()`, `_extractNonceFromData()`
  - View functions: `getExpectedNonce()`, `getLastUID()`, `hasPaidFee()`
  - Events: `FeeCharged`, `NonceIncremented`, `LastUIDAnchorSet`
  - Errors: `InvalidNonce`, `DeadlineExpired`, `InsufficientFee`, `InvalidEAS`
  - Implements required `ISchemaResolver` methods: `attest()`, `revoke()`, `isPayable()`, `multiAttest()`, `multiRevoke()`
  - Implements `ISemver.version()` returning "1.0.0"
- **Created `DeployFeeGate.s.sol`** (contracts/script/DeployFeeGate.s.sol):
  - Deployment script reading `EAS_ADDRESS` and `SCHEMA_UID` from environment
  - Deploys FeeGate bound to specific EAS instance and schema UID
- **Created comprehensive test suite** (contracts/test/FeeGate.t.sol):
  - `testFirstAttestationNoFee()` — validates no fee on first attestation
  - `testNonceValidation()` — validates nonce increment and replay prevention with `InvalidNonce` revert
  - `testFeeOnThirdAttestation()` — validates 100 GLMR charge on 3rd attestation, none thereafter
  - `testInsufficientFee()` — validates `InsufficientFee` revert when fee < LIFETIME_FEE
  - `testLastUIDAnchor()` — validates `lastUID` tracking updates to latest attestation UID

### Environment & Documentation

- Updated `.env.example` with Session 2 deployment variables: `EAS_ADDRESS`, `SCHEMA_UID`, `SCHEMA_REGISTRY_ADDRESS`, `SCHEMA_RESOLVER_ADDRESS`, `PRIVATE_KEY_DEPLOYER`
- Fixed test shadowing warnings by renaming loop variables to `loopAttestationData` and `loopRequest`
- Removed unused `override` keyword from `supportsInterface()` function

## Commands & Outputs

```bash
# Compilation (after fixes)
$ forge build
[⠊] Compiling 3 files with Solc 0.8.28
[⠘] Solc 0.8.28 finished in 1.66s
Compiler run successful with warnings
# (only linting style warnings remain)

# Test execution
$ forge test -vv
Ran 3 test suites in 190.58ms (16.54ms CPU time): 8 tests passed, 0 failed, 0 skipped (8 total tests)

Suite: SchemaRegTest (2 tests)
  ✓ testRegistersSchema() (gas: 648021)
  ✓ testRevertsOnDuplicate() (gas: 645926)

Suite: EASDeployTest (1 test)
  ✓ testDeploysRegistryAndEAS() (gas: 3568061)

Suite: FeeGateTest (5 tests)
  ✓ testFirstAttestationNoFee() (gas: 425321)
  ✓ testNonceValidation() (gas: 1095268)
  ✓ testFeeOnThirdAttestation() (gas: 1549168)
  ✓ testInsufficientFee() (gas: 1131848)
  ✓ testLastUIDAnchor() (gas: 761745)
```

## Artifacts

- **Contracts:**
  - contracts/src/FeeGate.sol (200 lines, full ISchemaResolver implementation)
  - contracts/script/DeployEAS.s.sol
  - contracts/script/RegisterSchema.s.sol
  - contracts/script/DeployFeeGate.s.sol

- **Tests:**
  - contracts/test/SchemaReg.t.sol (fixed imports/types)
  - contracts/test/EASDeploy.t.sol
  - contracts/test/FeeGate.t.sol (335 lines, 5 comprehensive tests)

- **Configuration:**
  - contracts/foundry.toml (fixed remappings and EVM version)
  - .env.example (updated with Session 2 variables)

## Test Summary

**8 total tests passing:**

- 3 EAS deployment/schema tests (SchemaReg + EASDeploy)
- 5 FeeGate resolver tests (nonce validation, fee charging, insufficient fee, lastUID tracking)

All tests validate:

- Nonce-based replay protection works correctly
- Fee is charged exactly on 3rd attestation (100 GLMR)
- Insufficient fee transactions revert properly
- Last-UID anchoring updates for latest-wins determinism
- First attestations require no fee

## Issues/Risks

**Resolved:**

- ✅ OpenZeppelin import path corrected (remapping fixed)
- ✅ EVM version updated to Cancun for mcopy instruction support
- ✅ SchemaRecord type import fixed (file-scope struct, not interface member)
- ✅ Error selector references corrected (implementation vs interface)
- ✅ FeeGate fully implemented with all required interface methods

**No outstanding blockers.**

## Next Session Entry Criteria

- Session 3: Implement attestation submission API (prepare + relay endpoints)
- Session 3 tasks: `/attest/prepare` endpoint (EIP-712 typed data), `/attest/relay` endpoint (send tx via FeeGate), handle third-attestation fee path, create OpenAPI spec in agent-context/api.md
- FeeGate contract is deployed and functional; ready for integration with backend relayer service

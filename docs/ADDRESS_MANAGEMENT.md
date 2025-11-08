# Address Management System

This project uses `addresses.json` to track all deployed contract addresses across networks with version history.

## Structure

```json
{
  "networks": {
    "moonbeam": {
      "chainId": 1284,
      "deployments": {
        "current": {
          "version": "v1",
          "timestamp": "2025-11-08T...",
          "SchemaRegistry": "0x...",
          "EAS": "0x...",
          "schemas": {
            "CubidTrust": {
              "uid": "0x...",
              "resolver": "0x...",
              "revocable": true
            }
          },
          "FeeGate": "0x..."
        },
        "history": [
          {
            "version": "v0",
            "timestamp": "2025-11-01T...",
            "reason": "Initial deployment",
            "SchemaRegistry": "0x...",
            ...
          }
        ]
      }
    }
  }
}
```

## Deployment Workflow

### 1. Deploy EAS Core Contracts

```bash
# Deploy SchemaRegistry and EAS
forge script contracts/script/DeployEAS.s.sol:DeployEAS --broadcast --rpc-url $MOONBEAM_RPC

# This automatically updates addresses.json with:
# - SchemaRegistry address
# - EAS address
# - Deployment timestamp
```

### 2. Register Schema

```bash
# Register the CubidTrust schema
forge script contracts/script/RegisterSchema.s.sol:RegisterSchema --broadcast --rpc-url $MOONBEAM_RPC

# This automatically:
# - Reads SchemaRegistry address from addresses.json
# - Registers schema and gets UID
# - Updates addresses.json with schema UID
```

### 3. Deploy FeeGate Resolver

```bash
# Deploy FeeGate resolver
forge script contracts/script/DeployFeeGate.s.sol:DeployFeeGate --broadcast --rpc-url $MOONBEAM_RPC

# This automatically:
# - Reads EAS address and schema UID from addresses.json
# - Deploys FeeGate contract
# - Updates addresses.json with FeeGate address
# - Updates schema resolver reference
```

## Network Detection

Scripts automatically detect the network based on chain ID:

- **1284**: Moonbeam (mainnet)
- **1287**: Moonbase Alpha (testnet)
- **31337**: Localhost (Anvil/Hardhat)

## Version Management

When redeploying contracts:

1. Move current deployment to `history` array
2. Update `current` with new addresses
3. Increment version (v1 → v2)
4. Document reason for redeployment

Example manual versioning:

```bash
# Before redeployment, backup current state
jq '.networks.moonbeam.deployments.history += [.networks.moonbeam.deployments.current]' addresses.json > temp.json
mv temp.json addresses.json

# Update version and reason
jq '.networks.moonbeam.deployments.current.version = "v2"' addresses.json > temp.json
mv temp.json addresses.json
```

## Reading Addresses Programmatically

### In Solidity Scripts

```solidity
function _getEASAddress(string memory network) internal view returns (address) {
  string memory root = vm.projectRoot();
  string memory path = string.concat(root, '/addresses.json');
  string memory json = vm.readFile(path);

  string memory key = string.concat('.networks.', network, '.deployments.current.EAS');
  return json.readAddress(key);
}
```

### In JavaScript/TypeScript

```typescript
import addresses from './addresses.json';

const network = 'moonbeam';
const easAddress = addresses.networks[network].deployments.current.EAS;
const schemaUID = addresses.networks[network].deployments.current.schemas.CubidTrust.uid;
```

## Benefits

- **Single Source of Truth**: All addresses in one place
- **Version Tracking**: Historical deployments preserved
- **Automation**: Scripts auto-update addresses after deployment
- **Network Agnostic**: Same structure for all networks
- **Type Safety**: JSON schema validation
- **Git Friendly**: Track address changes in version control

## Environment Variables

The `.env` file now only contains:

- **Private keys**: `PRIVATE_KEY_DEPLOYER`, `PRIVATE_KEY_RELAYER`
- **RPC URLs**: `MOONBEAM_RPC`, `MOONBASE_ALPHA_RPC`
- **Configuration**: `SCHEMA_REVOCABLE`

All contract addresses are managed through `addresses.json`.

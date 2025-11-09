# EAS Deployment Addresses

## Moonbeam (Mainnet)

- SchemaRegistry: `TODO`
- EAS: `TODO`
- FeeGate: `TODO`
- CubidTrust Schema UID: `TODO`
- Moonscan Verification:
  - SchemaRegistry: `https://moonscan.io/address/TODO#code`
  - EAS: `https://moonscan.io/address/TODO#code`
  - FeeGate: `https://moonscan.io/address/TODO#code`
- Deployment Tx Hashes:
  - DeployEAS: `0xTODO`
  - RegisterSchema: `0xTODO`
  - DeployFeeGate: `0xTODO`

## Local Anvil (Testing)

- SchemaRegistry: `0x0000000000000000000000000000000000000000`
- EAS: `0x0000000000000000000000000000000000000000`
- CubidTrust Schema UID: `0x0000000000000000000000000000000000000000000000000000000000000000`
- FeeGate: `0x0000000000000000000000000000000000000000`

## Notes

- Update these placeholders after running the Foundry scripts in `contracts/script/`.
- Mirror the same data into `addresses.json` so tooling stays in sync.
- Keep production and testnet entries current; add historical deployments to the `history` arrays in `addresses.json`.

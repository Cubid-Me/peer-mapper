# Moonbeam Mainnet Deployment Summary

**Date**: November 9, 2025  
**Network**: Moonbeam (Chain ID: 1284)  
**Deployer**: `0x50fDb6B1aF56DfE55cB484030C7b3b8787ff5f68`

## Deployed Contracts

### SchemaRegistry

- **Address**: `0xD680d4F3852A527BedbF12fB261F6922dfD98e28`
- **Transaction**: `0xba854d4412513de0cbf908b4140a5fc8e75fa5ce73163ec921955330f3add9bb`
- **Explorer**: https://moonscan.io/address/0xD680d4F3852A527BedbF12fB261F6922dfD98e28
- **Transaction URL**: https://moonscan.io/tx/0xba854d4412513de0cbf908b4140a5fc8e75fa5ce73163ec921955330f3add9bb

### EAS (Ethereum Attestation Service)

- **Address**: `0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75`
- **Transaction**: `0x8f8be3546790e75bb36e3f15ea2ec4af6fb47c70728f131f17577da2e261ad1e`
- **Explorer**: https://moonscan.io/address/0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75
- **Transaction URL**: https://moonscan.io/tx/0x8f8be3546790e75bb36e3f15ea2ec4af6fb47c70728f131f17577da2e261ad1e

### CubidTrust Schema

- **Schema UID**: `0x1b219d056f55ec3a19488c61f9d6afac696ab273cd615bfeaed122253bf1ad55`
- **Registration Transaction**: `0x87a90abfa3495f1f518371eba2829058f470f4be0c4b6ff984597eed43623b18`
- **Transaction URL**: https://moonscan.io/tx/0x87a90abfa3495f1f518371eba2829058f470f4be0c4b6ff984597eed43623b18
- **Resolver**: `0x1b79e8a759f06720E5a45105D29a707E51c44918` (FeeGate)
- **Revocable**: `true`
- **Schema Definition**:
  ```
  string cubidId,uint8 trustLevel,bool human,bytes32 circle,uint64 issuedAt,uint64 expiry,uint256 nonce
  ```
- **Note**: Initial schema without resolver (0xa519fee...) was registered first, then re-registered with FeeGate resolver

### FeeGate Resolver

- **Address**: `0x1b79e8a759f06720E5a45105D29a707E51c44918`
- **Transaction**: `0x383272228de69d00e380ad60dd143b93e75e0461ba5001d2bbdf82518ac90d51`
- **Explorer**: https://moonscan.io/address/0x1b79e8a759f06720E5a45105D29a707E51c44918
- **Transaction URL**: https://moonscan.io/tx/0x383272228de69d00e380ad60dd143b93e75e0461ba5001d2bbdf82518ac90d51
- **Initial Lifetime Fee**: `100 GLMR`
- **Fee Threshold**: `3rd attestation`
- **Deployer (Admin)**: `0x50fDb6B1aF56DfE55cB484030C7b3b8787ff5f68`

## Gas Costs

| Contract             | Estimated Gas  | Cost (@ 31.25 gwei) |
| -------------------- | -------------- | ------------------- |
| SchemaRegistry + EAS | 8,209,388      | 0.256543375 GLMR    |
| RegisterSchema       | 416,338        | 0.0130105625 GLMR   |
| DeployFeeGate        | 3,223,452      | 0.100732875 GLMR    |
| **Total**            | **11,849,178** | **~0.370 GLMR**     |

## Contract Verification

To verify contracts on Moonscan:

```bash
# SchemaRegistry (from EAS library)
forge verify-contract 0xD680d4F3852A527BedbF12fB261F6922dfD98e28 \
  SchemaRegistry \
  --chain moonbeam \
  --watch

# EAS (from EAS library)
forge verify-contract 0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75 \
  EAS \
  --constructor-args $(cast abi-encode "constructor(address)" 0xD680d4F3852A527BedbF12fB261F6922dfD98e28) \
  --chain moonbeam \
  --watch

# FeeGate
forge verify-contract 0x1b79e8a759f06720E5a45105D29a707E51c44918 \
  src/FeeGate.sol:FeeGate \
  --constructor-args $(cast abi-encode "constructor(address,bytes32)" 0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75 0xa519fee19287dff6c364f3eae0eb865bddcc4dba2070a3dd3c1c19395af10510) \
  --chain moonbeam \
  --watch
```

## FeeGate Admin Functions

The deployer address (`0x50fDb6B1aF56DfE55cB484030C7b3b8787ff5f68`) has exclusive access to:

1. **`setLifetimeFee(uint256 newFee)`** - Update the lifetime fee amount
2. **`withdraw()`** - Withdraw accumulated fees

Example usage:

```bash
# Check current fee
cast call 0x1b79e8a759f06720E5a45105D29a707E51c44918 "lifetimeFee()(uint256)" --rpc-url https://rpc.api.moonbeam.network

# Update fee (requires deployer key)
cast send 0x1b79e8a759f06720E5a45105D29a707E51c44918 \
  "setLifetimeFee(uint256)" 50000000000000000000 \
  --private-key $PRIVATE_KEY_DEPLOYER \
  --rpc-url https://rpc.api.moonbeam.network \
  --legacy

# Withdraw fees (requires deployer key)
cast send 0x1b79e8a759f06720E5a45105D29a707E51c44918 \
  "withdraw()" \
  --private-key $PRIVATE_KEY_DEPLOYER \
  --rpc-url https://rpc.api.moonbeam.network \
  --legacy
```

## Integration URLs

### Frontend Environment Variables

Update `frontend/.env.local`:

```env
NEXT_PUBLIC_CHAIN_ID=1284
NEXT_PUBLIC_SCHEMA_REGISTRY=0xD680d4F3852A527BedbF12fB261F6922dfD98e28
NEXT_PUBLIC_EAS_ADDR=0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75
NEXT_PUBLIC_SCHEMA_UID=0x1b219d056f55ec3a19488c61f9d6afac696ab273cd615bfeaed122253bf1ad55
NEXT_PUBLIC_FEEGATE_ADDR=0x1b79e8a759f06720E5a45105D29a707E51c44918
```

### Indexer Environment Variables

Update `indexer/.env`:

```env
MOONBEAM_RPC=https://rpc.api.moonbeam.network
REGISTRY_ADDR=0xD680d4F3852A527BedbF12fB261F6922dfD98e28
EAS_ADDR=0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75
SCHEMA_UID=0x1b219d056f55ec3a19488c61f9d6afac696ab273cd615bfeaed122253bf1ad55
FEEGATE_ADDR=0x1b79e8a759f06720E5a45105D29a707E51c44918
```

## Next Steps

1. ✅ Contracts deployed to Moonbeam
2. ⏳ Verify contracts on Moonscan (optional but recommended)
3. ⏳ Update frontend environment variables
4. ⏳ Update indexer configuration
5. ⏳ Deploy indexer to production
6. ⏳ Deploy frontend to Vercel
7. ⏳ End-to-end testing on mainnet

## Notes

- All contracts compiled with Solidity 0.8.28
- Legacy transaction mode used for compatibility with Moonbeam
- EIP-3855 warning is expected and doesn't affect functionality
- Schema UID is deterministic based on the schema definition
- FeeGate is configured as the resolver for the CubidTrust schema
- Initial lifetime fee: 100 GLMR (changeable by deployer)
- Fee charged on 3rd attestation per issuer
- Nonce-based replay protection implemented

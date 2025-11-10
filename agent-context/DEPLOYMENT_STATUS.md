# Production Deployment Status

**Last Updated**: November 9, 2025

## ✅ Completed Steps

### 1. Smart Contracts Deployed to Moonbeam ✅

All contracts successfully deployed and verified:

| Contract          | Address                                                              | Status                            |
| ----------------- | -------------------------------------------------------------------- | --------------------------------- |
| SchemaRegistry    | `0xD680d4F3852A527BedbF12fB261F6922dfD98e28`                         | ✅ Deployed                       |
| EAS               | `0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75`                         | ✅ Deployed                       |
| FeeGate           | `0x1b79e8a759f06720E5a45105D29a707E51c44918`                         | ✅ Deployed & Verified (Sourcify) |
| CubidTrust Schema | `0x1b219d056f55ec3a19488c61f9d6afac696ab273cd615bfeaed122253bf1ad55` | ✅ Registered                     |

**Total Cost**: ~0.379 GLMR

**Verification**:

- FeeGate verified on Sourcify: ✅
- View on Moonscan: https://moonscan.io/address/0x1b79e8a759f06720E5a45105D29a707E51c44918#code

### 2. Frontend Configuration Updated ✅

Updated `frontend/.env.local` with production addresses:

```env
NEXT_PUBLIC_SCHEMA_REGISTRY=0xD680d4F3852A527BedbF12fB261F6922dfD98e28
NEXT_PUBLIC_EAS_ADDR=0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75
NEXT_PUBLIC_FEEGATE_ADDR=0x1b79e8a759f06720E5a45105D29a707E51c44918
NEXT_PUBLIC_SCHEMA_UID=0x1b219d056f55ec3a19488c61f9d6afac696ab273cd615bfeaed122253bf1ad55
NEXT_PUBLIC_CHAIN_ID=1284
```

**Build Status**: ✅ Successful  
**Test Status**: ✅ 17/17 tests passing

### 3. Indexer Configuration Updated ✅

Created `indexer/.env` with production addresses:

```env
REGISTRY_ADDR=0xD680d4F3852A527BedbF12fB261F6922dfD98e28
EAS_ADDR=0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75
SCHEMA_UID=0x1b219d056f55ec3a19488c61f9d6afac696ab273cd615bfeaed122253bf1ad55
FEEGATE_ADDR=0x1b79e8a759f06720E5a45105D29a707E51c44918
MOONBEAM_RPC=https://rpc.api.moonbeam.network
```

**Build Status**: ✅ Successful  
**Test Status**: ✅ 21/21 tests passing

### 4. Contract Verification ✅

FeeGate contract verified on Sourcify (decentralized verification).

## 📋 Next Steps (Remaining)

### 5. Deploy Indexer to Production ⏳

**Options**:

- **Fly.io** (Recommended): Docker-based deployment with PostgreSQL
- **Render**: Alternative cloud platform
- **Railway**: Another option

**Requirements**:

- Docker image built from `indexer/Dockerfile`
- Environment variables set in platform
- PostgreSQL database provisioned
- Health check endpoint: `/health`

**Commands for Fly.io**:

```bash
cd indexer
fly launch --no-deploy
fly secrets set \
  DATABASE_URL="postgres://..." \
  REGISTRY_ADDR="0xD680d4F3852A527BedbF12fB261F6922dfD98e28" \
  EAS_ADDR="0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75" \
  SCHEMA_UID="0x1b219d056f55ec3a19488c61f9d6afac696ab273cd615bfeaed122253bf1ad55" \
  FEEGATE_ADDR="0x1b79e8a759f06720E5a45105D29a707E51c44918" \
  MOONBEAM_RPC="https://rpc.api.moonbeam.network" \
  PRIVATE_KEY_RELAYER="0x..." \
  SUPABASE_URL="https://bgppeedfgmybkjbulckr.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  SUPABASE_JWT_SECRET="..."
fly deploy
```

### 6. Deploy Frontend to Vercel ⏳

**Requirements**:

- Vercel account connected to GitHub
- Environment variables configured in Vercel dashboard
- Production domain configured

**Environment Variables for Vercel**:

```
NEXT_PUBLIC_SCHEMA_REGISTRY=0xD680d4F3852A527BedbF12fB261F6922dfD98e28
NEXT_PUBLIC_EAS_ADDR=0xd3cC2cfEb2904b465b0743460e38FeD0C1Ed1c75
NEXT_PUBLIC_FEEGATE_ADDR=0x1b79e8a759f06720E5a45105D29a707E51c44918
NEXT_PUBLIC_SCHEMA_UID=0x1b219d056f55ec3a19488c61f9d6afac696ab273cd615bfeaed122253bf1ad55
NEXT_PUBLIC_CHAIN_ID=1284
NEXT_PUBLIC_INDEXER_URL=https://your-indexer.fly.dev
NEXT_PUBLIC_SUPABASE_URL=https://bgppeedfgmybkjbulckr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**Deployment Commands**:

```bash
# Using Vercel CLI
cd frontend
vercel --prod

# Or connect repository in Vercel dashboard
# https://vercel.com/new
```

### 7. End-to-End Testing ⏳

Once indexer and frontend are deployed:

**Test Flow**:

1. Visit production frontend URL
2. Sign in with email (Supabase auth)
3. Complete new user onboarding (Cubid verification)
4. Create attestation by vouching for someone
5. Scan QR code to verify attestation
6. Check results page shows trust levels

**Verification**:

- Check Moonscan for attestation transactions
- Verify indexer logs show event processing
- Confirm Supabase database has attestation records
- Test wallet connection on Moonbeam network

## 🔒 Security Notes

**Private Keys in Use**:

- ✅ Deployer: `0x50fDb6B1aF56DfE55cB484030C7b3b8787ff5f68` (FeeGate admin)
- ✅ Relayer: `0xA006F855B7c44c2ad8456BFF8398B3f8619E8D39` (Meta-transactions)

**Admin Functions Available**:

- `setLifetimeFee(uint256)` - Change attestation fee (deployer only)
- `withdraw()` - Withdraw accumulated fees (deployer only)

**Current Fee**: 100 GLMR (charged on 3rd attestation per issuer)

## 📊 Test Summary

| Component | Tests     | Status         |
| --------- | --------- | -------------- |
| Contracts | 15/15     | ✅ All passing |
| Frontend  | 17/17     | ✅ All passing |
| Indexer   | 21/21     | ✅ All passing |
| **Total** | **53/53** | ✅ **100%**    |

## 📚 Documentation

- Contract deployment details: `contracts/MOONBEAM_DEPLOYMENT.md`
- Wallet troubleshooting: `docs/WALLET_TROUBLESHOOTING.md`
- Project README: `README.md`

## 🎯 Production Readiness Checklist

- [x] Smart contracts deployed to Moonbeam
- [x] Contracts verified (Sourcify)
- [x] Frontend configured with production addresses
- [x] Indexer configured with production addresses
- [x] All tests passing (53/53)
- [x] Environment variables documented
- [ ] Indexer deployed to cloud platform
- [ ] Frontend deployed to Vercel
- [ ] End-to-end testing completed
- [ ] Production monitoring setup
- [ ] Documentation finalized

**Status**: Ready for cloud deployment (Steps 5-7)

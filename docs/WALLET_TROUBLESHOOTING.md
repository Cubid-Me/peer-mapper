# Wallet Troubleshooting Guide

## Common Error: "Cannot redefine property: ethereum"

### What causes this error?

This error occurs when you have multiple wallet browser extensions installed (e.g., MetaMask, Phantom, Coinbase Wallet, etc.) that are competing to inject the `window.ethereum` object into the page.

**Example error:**

```
Runtime TypeError
Cannot redefine property: ethereum
```

### Solutions

#### Option 1: Disable Conflicting Extensions (Recommended)

1. Open your browser's extension manager:
   - **Chrome/Brave**: `chrome://extensions/`
   - **Firefox**: `about:addons`
   - **Edge**: `edge://extensions/`

2. Disable all wallet extensions except the one you want to use
   - For Moonbeam, we recommend **MetaMask** or **Talisman**

3. Reload the page

#### Option 2: Use Different Browser Profiles

1. Create separate browser profiles for different wallets:
   - **Chrome**: Settings → Users → Add person
   - **Firefox**: about:profiles
   - **Brave**: Settings → Create profile

2. Install only one wallet per profile

#### Option 3: Change Extension Load Order

Some browsers allow you to change the order extensions load:

1. Disable all wallet extensions
2. Enable only your preferred wallet first
3. Reload the page before enabling other extensions

### Recommended Wallet Setup for Moonbeam

**Primary wallet**: MetaMask or Talisman

- Both have excellent Moonbeam support
- Moonbeam is EVM-compatible, so MetaMask works natively

**Network Configuration**:

- **Network Name**: Moonbeam
- **RPC URL**: `https://rpc.api.moonbeam.network`
- **Chain ID**: `1284`
- **Currency Symbol**: GLMR
- **Block Explorer**: `https://moonscan.io`

### For Developers

If you encounter this error during development:

1. **Check your extensions** - Disable unnecessary wallet extensions
2. **Use a clean profile** - Test in a browser profile with only one wallet
3. **Clear browser cache** - Sometimes cached scripts cause conflicts
4. **Check console errors** - Look for which extension is causing the conflict

### Still Having Issues?

If you continue to experience problems:

1. Try using a private/incognito window with extensions disabled
2. Check if your wallet extension is up to date
3. Verify your wallet supports the Moonbeam network (Chain ID: 1284)
4. Contact support with your browser version and installed extensions list

### Technical Details

The error occurs because:

- Each wallet extension tries to define `window.ethereum` using `Object.defineProperty()`
- The property is marked as non-configurable
- When a second extension tries to redefine it, JavaScript throws a TypeError

This is a known limitation of the wallet injection pattern and affects all dapps, not just this one.

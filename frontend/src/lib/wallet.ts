export async function ensureWallet() {
  if (typeof window === "undefined") {
    throw new Error("Wallet not available (server-side)");
  }
  
  const win = window as typeof window & { ethereum?: { request(args: { method: string }): Promise<unknown> } };
  
  if (!win.ethereum) {
    throw new Error(
      "No wallet detected. Please install MetaMask or another Web3 wallet. " +
      "If you have multiple wallets installed, try disabling all but one and reload the page."
    );
  }

  try {
    const ethereum = win.ethereum;
    const [account] = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
    return account;
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's the wallet conflict error
      if (error.message.includes("ethereum") || error.message.includes("redefine")) {
        throw new Error(
          "Multiple wallet extensions detected. Please disable all wallet extensions except one, " +
          "then reload the page. See docs/WALLET_TROUBLESHOOTING.md for help."
        );
      }
      throw error;
    }
    throw new Error("Failed to connect wallet");
  }
}

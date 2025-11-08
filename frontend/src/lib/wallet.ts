export async function ensureWallet() {
  if (typeof window === "undefined" || !(window as typeof window & { ethereum?: unknown }).ethereum) {
    throw new Error("Wallet not detected");
  }
  const ethereum = (window as typeof window & { ethereum?: { request(args: { method: string }): Promise<unknown> } })
    .ethereum!;
  const [account] = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  return account;
}

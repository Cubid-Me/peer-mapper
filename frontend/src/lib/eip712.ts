export type TypedData = {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
};

export function buildAttestationTypedData(message: Record<string, unknown>): TypedData {
  return {
    domain: {
      name: "FeeGate",
      version: "1",
      chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 1284),
      verifyingContract: process.env.NEXT_PUBLIC_FEEGATE_ADDR ?? "0x0",
    },
    types: {
      Attestation: Object.entries(message).map(([name, value]) => ({
        name,
        type: typeof value === "boolean" ? "bool" : "string",
      })),
    },
    primaryType: "Attestation",
    message,
  };
}

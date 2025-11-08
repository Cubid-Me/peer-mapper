export interface TypedDataPayload {
  cubidId: string;
  trustLevel: number;
  human: boolean;
  circle: string;
  issuedAt: number;
  expiry: number;
  nonce: bigint;
  deadline: number;
}

export function buildTypedData(payload: TypedDataPayload) {
  return {
    types: {
      Attestation: [
        { name: 'issuer', type: 'address' },
        { name: 'cubidId', type: 'string' },
        { name: 'trustLevel', type: 'uint8' },
        { name: 'human', type: 'bool' },
        { name: 'circle', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint64' },
        { name: 'expiry', type: 'uint64' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint64' },
      ],
    },
    primaryType: 'Attestation',
    message: payload,
  };
}

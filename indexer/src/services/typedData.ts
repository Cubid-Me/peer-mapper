export interface AttestationMessage {
  issuer: `0x${string}`;
  recipient: `0x${string}`;
  refUID: `0x${string}`;
  revocable: boolean;
  expirationTime: number;
  cubidId: string;
  trustLevel: number;
  human: boolean;
  circle: `0x${string}`;
  issuedAt: number;
  expiry: number;
  nonce: string;
  deadline: number;
}

export interface TypedDataDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

export interface AttestationTypedData {
  domain: TypedDataDomain;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: 'Attestation';
  message: AttestationMessage;
}

export function buildTypedData(domain: TypedDataDomain, message: AttestationMessage): AttestationTypedData {
  return {
    domain,
    types: {
      Attestation: [
        { name: 'issuer', type: 'address' },
        { name: 'recipient', type: 'address' },
        { name: 'refUID', type: 'bytes32' },
        { name: 'revocable', type: 'bool' },
        { name: 'expirationTime', type: 'uint64' },
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
    message,
  };
}

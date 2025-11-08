// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {
    IEAS,
    Attestation,
    AttestationRequest,
    AttestationRequestData
} from 'eas-contracts/IEAS.sol';
import {Signature} from 'eas-contracts/Common.sol';
import {ISchemaResolver} from 'eas-contracts/resolver/ISchemaResolver.sol';
import {EIP712} from '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

struct AttestationPayload {
    address recipient;
    bytes32 refUID;
    bool revocable;
    uint64 expirationTime;
    string cubidId;
    uint8 trustLevel;
    bool human;
    bytes32 circle;
    uint64 issuedAt;
    uint64 expiry;
}

/**
 * @title FeeGate
 * @notice EAS resolver and attestation gate that enforces nonce-based replay protection
 *         and a one-time fee on the third attestation per issuer. Supports both direct
 *         issuers and delegated (meta-transaction) attestations.
 */
contract FeeGate is ISchemaResolver, EIP712 {
    using ECDSA for bytes32;

    // Constants
    uint256 public constant LIFETIME_FEE = 100 ether; // 100 GLMR
    uint256 public constant FEE_THRESHOLD = 3; // Fee charged on 3rd attestation
    bytes32 public constant ATTESTATION_TYPEHASH =
        keccak256(
            'Attestation(address issuer,string cubidId,uint8 trustLevel,bool human,bytes32 circle,'
            'uint64 issuedAt,uint64 expiry,uint256 nonce,uint64 deadline)'
        );

    // Immutable state
    IEAS public immutable eas;
    bytes32 public immutable schemaUID;

    // Per-issuer state
    mapping(address => uint256) public attestCount;
    mapping(address => bool) public lifetimeFeePaid;
    mapping(address => uint256) public issuerNonce;
    mapping(address => mapping(bytes32 => bytes32)) private _lastUID;

    // Context shared between attestation submission and resolver callback
    address private _currentIssuer;

    // Events
    event FeeCharged(address indexed issuer, uint256 amount, uint256 count);
    event NonceIncremented(address indexed issuer, uint256 newNonce);
    event LastUIDAnchorSet(address indexed issuer, string cubidId, bytes32 uid);

    // Errors
    error InvalidNonce();
    error DeadlineExpired();
    error InsufficientFee();
    error InvalidEAS();
    error InvalidSignature();
    error UnexpectedValue();
    error InvalidRecipient();

    /**
     * @param _eas Address of the EAS contract
     * @param _schemaUID Schema UID this resolver is bound to
     */
    constructor(IEAS _eas, bytes32 _schemaUID) EIP712('FeeGate', '1') {
        if (address(_eas) == address(0)) revert InvalidEAS();
        eas = _eas;
        schemaUID = _schemaUID;
    }

    /**
     * @notice Submit an attestation directly from the issuer's wallet
     */
    function attestDirect(
        AttestationPayload calldata payload
    ) external payable returns (bytes32 uid) {
        address issuer = msg.sender;
        if (payload.recipient == address(0)) revert InvalidRecipient();

        uint256 nonce = issuerNonce[issuer];
        uint256 nextCount = attestCount[issuer] + 1;
        _precheckFee(issuer, msg.value, nextCount);

        AttestationRequest memory request = _buildRequest(payload, nonce, msg.value);

        _currentIssuer = issuer;
        uid = eas.attest{value: msg.value}(request);
        _currentIssuer = address(0);
    }

    /**
     * @notice Submit an attestation by relaying a wallet-signed payload
     * @param payload Structured attestation payload
     * @param issuer Address of the wallet that signed the payload
     * @param nonce Expected nonce (must equal FeeGate.issuerNonce[issuer])
     * @param deadline Unix timestamp after which the signature expires
     * @param signature Wallet signature authorising this attestation
     */
    function attestDelegated(
        AttestationPayload calldata payload,
        address issuer,
        uint256 nonce,
        uint64 deadline,
        Signature calldata signature
    ) external payable returns (bytes32 uid) {
        if (issuer == address(0)) revert InvalidRecipient();
        if (payload.recipient == address(0)) revert InvalidRecipient();
        if (nonce != issuerNonce[issuer]) revert InvalidNonce();
        if (deadline != 0 && block.timestamp > deadline) revert DeadlineExpired();

        uint256 nextCount = attestCount[issuer] + 1;
        _precheckFee(issuer, msg.value, nextCount);

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ATTESTATION_TYPEHASH,
                    issuer,
                    keccak256(bytes(payload.cubidId)),
                    payload.trustLevel,
                    payload.human,
                    payload.circle,
                    payload.issuedAt,
                    payload.expiry,
                    nonce,
                    deadline
                )
            )
        );
        address recovered = ECDSA.recover(digest, signature.v, signature.r, signature.s);
        if (recovered != issuer) revert InvalidSignature();

        AttestationRequest memory request = _buildRequest(payload, nonce, msg.value);

        _currentIssuer = issuer;
        uid = eas.attest{value: msg.value}(request);
        _currentIssuer = address(0);
    }

    /**
     * @notice Called by EAS when an attestation is made
     */
    function attest(Attestation calldata attestation) external payable override returns (bool) {
        if (msg.sender != address(eas)) revert InvalidEAS();

        address issuer = _currentIssuer;
        if (issuer == address(0)) {
            issuer = attestation.attester;
        }

        (string memory cubidId, , , , , , uint256 providedNonce) = abi.decode(
            attestation.data,
            (string, uint8, bool, bytes32, uint64, uint64, uint256)
        );

        uint256 expectedNonce = issuerNonce[issuer];
        if (providedNonce != expectedNonce) revert InvalidNonce();

        uint256 newNonce = expectedNonce + 1;
        issuerNonce[issuer] = newNonce;
        emit NonceIncremented(issuer, newNonce);

        uint256 newCount = attestCount[issuer] + 1;
        _enforceFee(issuer, msg.value, newCount);
        attestCount[issuer] = newCount;

        bytes32 cubidKey = keccak256(bytes(cubidId));
        _lastUID[issuer][cubidKey] = attestation.uid;
        emit LastUIDAnchorSet(issuer, cubidId, attestation.uid);

        _currentIssuer = address(0);

        return true;
    }

    /**
     * @notice Called by EAS when an attestation is revoked
     */
    function revoke(
        Attestation calldata /* attestation */
    ) external payable override returns (bool) {
        if (msg.sender != address(eas)) revert InvalidEAS();
        return true;
    }

    /**
     * @notice Expose the domain separator for front-ends generating signatures
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Compute the typed data hash used for delegated attestations
     */
    function hashAttestation(
        address issuer,
        string calldata cubidId,
        uint8 trustLevel,
        bool human,
        bytes32 circle,
        uint64 issuedAt,
        uint64 expiry,
        uint256 nonce,
        uint64 deadline
    ) external view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        ATTESTATION_TYPEHASH,
                        issuer,
                        keccak256(bytes(cubidId)),
                        trustLevel,
                        human,
                        circle,
                        issuedAt,
                        expiry,
                        nonce,
                        deadline
                    )
                )
            );
    }

    /**
     * @notice Get the last UID for an issuer and cubidId
     */
    function getLastUID(address issuer, string calldata cubidId) external view returns (bytes32) {
        return _lastUID[issuer][keccak256(bytes(cubidId))];
    }

    /**
     * @notice Check if an issuer has paid the lifetime fee
     */
    function hasPaidFee(address issuer) external view returns (bool) {
        return lifetimeFeePaid[issuer];
    }

    /**
     * @notice Returns whether the resolver supports ETH payments
     */
    function isPayable() external pure override returns (bool) {
        return true;
    }

    function multiAttest(
        Attestation[] calldata,
        /* attestations */
        uint256[] calldata /* values */
    ) external payable override returns (bool) {
        return true;
    }

    function multiRevoke(
        Attestation[] calldata,
        /* attestations */
        uint256[] calldata /* values */
    ) external payable override returns (bool) {
        return true;
    }

    function version() external pure returns (string memory) {
        return '1.0.0';
    }

    receive() external payable {}

    // Internal helpers
    function _buildRequest(
        AttestationPayload calldata payload,
        uint256 nonce,
        uint256 value
    ) internal view returns (AttestationRequest memory request) {
        bytes memory data = abi.encode(
            payload.cubidId,
            payload.trustLevel,
            payload.human,
            payload.circle,
            payload.issuedAt,
            payload.expiry,
            nonce
        );

        request = AttestationRequest({
            schema: schemaUID,
            data: AttestationRequestData({
                recipient: payload.recipient,
                expirationTime: payload.expirationTime,
                revocable: payload.revocable,
                refUID: payload.refUID,
                data: data,
                value: value
            })
        });
    }

    function _precheckFee(address issuer, uint256 supplied, uint256 newCount) internal view {
        bool paid = lifetimeFeePaid[issuer];
        if (!paid) {
            if (newCount < FEE_THRESHOLD) {
                if (supplied != 0) revert UnexpectedValue();
            } else if (newCount == FEE_THRESHOLD) {
                if (supplied != LIFETIME_FEE) revert InsufficientFee();
            } else {
                revert InsufficientFee();
            }
        } else if (supplied != 0) {
            revert UnexpectedValue();
        }
    }

    function _enforceFee(address issuer, uint256 supplied, uint256 newCount) internal {
        bool paid = lifetimeFeePaid[issuer];
        if (!paid) {
            if (newCount < FEE_THRESHOLD) {
                if (supplied != 0) revert UnexpectedValue();
            } else if (newCount == FEE_THRESHOLD) {
                if (supplied != LIFETIME_FEE) revert InsufficientFee();
                lifetimeFeePaid[issuer] = true;
                emit FeeCharged(issuer, LIFETIME_FEE, newCount);
            } else {
                revert InsufficientFee();
            }
        } else if (supplied != 0) {
            revert UnexpectedValue();
        }
    }
}

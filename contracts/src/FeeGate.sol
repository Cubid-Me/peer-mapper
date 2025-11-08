// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IEAS, Attestation} from 'eas-contracts/IEAS.sol';
import {SchemaRecord} from 'eas-contracts/ISchemaRegistry.sol';
import {ISchemaResolver} from 'eas-contracts/resolver/ISchemaResolver.sol';

/**
 * @title FeeGate
 * @notice EAS resolver that enforces nonce-based replay protection and charges a one-time fee on the 3rd attestation
 * @dev Implements:
 *      - Per-issuer nonce check for delegated attestations
 *      - 100 GLMR fee on the 3rd attestation per issuer (one-time lifetime fee)
 *      - Optional last-UID anchor for latest-wins determinism
 */
contract FeeGate is ISchemaResolver {
    // Constants
    uint256 public constant LIFETIME_FEE = 100 ether; // 100 GLMR
    uint256 public constant FEE_THRESHOLD = 3; // Fee charged on 3rd attestation

    // Immutable state
    IEAS public immutable eas;
    bytes32 public immutable schemaUID;

    // Per-issuer state
    mapping(address => uint256) public attestCount;
    mapping(address => bool) public lifetimeFeePaid;
    mapping(address => uint256) public issuerNonce;

    // Optional last-UID anchor for determinism
    mapping(address => mapping(string => bytes32)) public lastUID;

    // Events
    event FeeCharged(address indexed issuer, uint256 amount, uint256 count);
    event NonceIncremented(address indexed issuer, uint256 newNonce);
    event LastUIDAnchorSet(address indexed issuer, string cubidId, bytes32 uid);

    // Errors
    error InvalidNonce();
    error DeadlineExpired();
    error InsufficientFee();
    error InvalidEAS();

    /**
     * @param _eas Address of the EAS contract
     * @param _schemaUID Schema UID this resolver is bound to
     */
    constructor(IEAS _eas, bytes32 _schemaUID) {
        if (address(_eas) == address(0)) revert InvalidEAS();
        eas = _eas;
        schemaUID = _schemaUID;
    }

    /**
     * @notice Called by EAS when an attestation is made
     * @dev Validates nonce, collects fee if needed, updates state
     */
    function attest(Attestation calldata attestation) external payable override returns (bool) {
        if (msg.sender != address(eas)) revert InvalidEAS();

        address issuer = attestation.attester;

        // Check and increment nonce for replay protection
        uint256 expectedNonce = issuerNonce[issuer];
        // Decode nonce from attestation data (last uint256 in schema)
        uint256 providedNonce = abi.decode(_extractNonceFromData(attestation.data), (uint256));
        if (providedNonce != expectedNonce) revert InvalidNonce();

        issuerNonce[issuer] = expectedNonce + 1;
        emit NonceIncremented(issuer, expectedNonce + 1);

        // Increment attestation count
        attestCount[issuer]++;
        uint256 count = attestCount[issuer];

        // Charge fee on 3rd attestation if not already paid
        if (count == FEE_THRESHOLD && !lifetimeFeePaid[issuer]) {
            if (msg.value < LIFETIME_FEE) revert InsufficientFee();
            lifetimeFeePaid[issuer] = true;
            emit FeeCharged(issuer, LIFETIME_FEE, count);
            // Keep excess fee if any
        }

        // Update last-UID anchor for determinism
        string memory cubidId = _extractCubidId(attestation.data);
        lastUID[issuer][cubidId] = attestation.uid;
        emit LastUIDAnchorSet(issuer, cubidId, attestation.uid);

        return true;
    }

    /**
     * @notice Called by EAS when an attestation is revoked
     * @dev Currently no-op, but could implement revocation logic
     */
    function revoke(
        Attestation calldata /* attestation */
    ) external payable override returns (bool) {
        if (msg.sender != address(eas)) revert InvalidEAS();
        // No special revocation logic needed for MVP
        return true;
    }

    /**
     * @notice Check if this contract supports a given interface
     */
    function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
        return interfaceID == type(ISchemaResolver).interfaceId;
    }

    /**
     * @notice Get the expected nonce for an issuer
     */
    function getExpectedNonce(address issuer) external view returns (uint256) {
        return issuerNonce[issuer];
    }

    /**
     * @notice Get the last UID for an issuer and cubidId
     */
    function getLastUID(address issuer, string calldata cubidId) external view returns (bytes32) {
        return lastUID[issuer][cubidId];
    }

    /**
     * @notice Check if an issuer has paid the lifetime fee
     */
    function hasPaidFee(address issuer) external view returns (bool) {
        return lifetimeFeePaid[issuer];
    }

    // Internal helpers

    /**
     * @dev Extract cubidId from attestation data (first field in schema)
     * Schema: string cubidId,uint8 trustLevel,bool human,bytes32 circle,uint64 issuedAt,uint64 expiry,uint256 nonce
     */
    function _extractCubidId(bytes memory data) internal pure returns (string memory) {
        (string memory cubidId, , , , , , ) = abi.decode(
            data,
            (string, uint8, bool, bytes32, uint64, uint64, uint256)
        );
        return cubidId;
    }

    /**
     * @dev Extract nonce from attestation data (last field in schema)
     */
    function _extractNonceFromData(bytes memory data) internal pure returns (bytes memory) {
        (, , , , , , uint256 nonce) = abi.decode(
            data,
            (string, uint8, bool, bytes32, uint64, uint64, uint256)
        );
        return abi.encode(nonce);
    }

    /**
     * @notice Returns whether the resolver supports ETH payments
     * @return true - this resolver accepts ETH for fees
     */
    function isPayable() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Batch attestation callback (not implemented in MVP)
     * @dev Always returns true for now
     */
    function multiAttest(
        Attestation[] calldata /* attestations */,
        uint256[] calldata /* values */
    ) external payable returns (bool) {
        // Not implemented in MVP - would need to validate each attestation's nonce and aggregate fees
        return true;
    }

    /**
     * @notice Batch revocation callback (not implemented in MVP)
     * @dev Always returns true for now
     */
    function multiRevoke(
        Attestation[] calldata /* attestations */,
        uint256[] calldata /* values */
    ) external payable returns (bool) {
        // Not implemented in MVP
        return true;
    }

    /**
     * @notice Returns the semantic version of this contract
     * @return Semantic version string
     */
    function version() external pure returns (string memory) {
        return '1.0.0';
    }

    /**
     * @notice Allow contract to receive ETH
     */
    receive() external payable {}
}

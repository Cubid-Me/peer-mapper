// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from 'forge-std/Test.sol';
import {FeeGate} from '../src/FeeGate.sol';
import {SchemaRegistry} from 'eas-contracts/SchemaRegistry.sol';
import {EAS, Attestation, AttestationRequest, AttestationRequestData} from 'eas-contracts/EAS.sol';
import {ISchemaResolver} from 'eas-contracts/resolver/ISchemaResolver.sol';
import {IEAS} from 'eas-contracts/IEAS.sol';

contract FeeGateTest is Test {
    FeeGate public feeGate;
    SchemaRegistry public registry;
    EAS public eas;
    bytes32 public schemaUID;

    address public issuer = address(0x1);
    address public recipient = address(0x2);

    string constant SCHEMA =
        'string cubidId,uint8 trustLevel,bool human,bytes32 circle,uint64 issuedAt,uint64 expiry,uint256 nonce';

    function setUp() public {
        // Deploy EAS infrastructure
        registry = new SchemaRegistry();
        eas = new EAS(registry);

        // Deploy FeeGate first (with placeholder schema UID)
        feeGate = new FeeGate(IEAS(address(eas)), bytes32(0));

        // Register schema WITH FeeGate resolver
        schemaUID = registry.register(SCHEMA, ISchemaResolver(address(feeGate)), true);

        // Update FeeGate with actual schema UID (redeploy with correct UID)
        feeGate = new FeeGate(IEAS(address(eas)), schemaUID);

        // Re-register schema with the correct FeeGate instance
        schemaUID = registry.register(
            string(abi.encodePacked(SCHEMA, '_v2')), // Unique schema to avoid duplicate
            ISchemaResolver(address(feeGate)),
            true
        );

        // Give issuer some ETH for fees
        vm.deal(issuer, 1000 ether);
    }

    function testFirstAttestationNoFee() public {
        vm.startPrank(issuer);

        bytes memory attestationData = abi.encode(
            'cubid123', // cubidId
            uint8(5), // trustLevel
            true, // human
            bytes32(uint256(1)), // circle
            uint64(block.timestamp), // issuedAt
            uint64(0), // expiry (0 = no expiry)
            uint256(0) // nonce
        );

        AttestationRequest memory request = AttestationRequest({
            schema: schemaUID,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: attestationData,
                value: 0
            })
        });

        // First attestation should not require fee
        bytes32 uid = eas.attest(request);

        assertEq(feeGate.attestCount(issuer), 1); // Count incremented by resolver
        assertEq(feeGate.issuerNonce(issuer), 1); // Nonce incremented to 1
        assertFalse(feeGate.hasPaidFee(issuer)); // No fee required for first attestation

        vm.stopPrank();
    }

    function testNonceValidation() public {
        vm.startPrank(issuer);

        // First attestation with nonce 0
        bytes memory attestationData = abi.encode(
            'cubid123',
            uint8(5),
            true,
            bytes32(uint256(1)),
            uint64(block.timestamp),
            uint64(0),
            uint256(0) // correct nonce
        );

        AttestationRequest memory request = AttestationRequest({
            schema: schemaUID,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: attestationData,
                value: 0
            })
        });

        bytes32 uid = eas.attest(request);
        assertEq(feeGate.issuerNonce(issuer), 1);

        // Try to reuse nonce 0 - should fail
        vm.expectRevert(FeeGate.InvalidNonce.selector);
        eas.attest(request);

        // Use correct nonce 1
        attestationData = abi.encode(
            'cubid456',
            uint8(5),
            true,
            bytes32(uint256(1)),
            uint64(block.timestamp),
            uint64(0),
            uint256(1) // correct next nonce
        );

        request.data.data = attestationData;
        uid = eas.attest(request);
        assertEq(feeGate.issuerNonce(issuer), 2);

        vm.stopPrank();
    }

    function testFeeOnThirdAttestation() public {
        vm.startPrank(issuer);

        // First two attestations - no fee required
        for (uint256 i = 0; i < 2; i++) {
            bytes memory loopAttestationData = abi.encode(
                string(abi.encodePacked('cubid', vm.toString(i))),
                uint8(5),
                true,
                bytes32(uint256(1)),
                uint64(block.timestamp),
                uint64(0),
                i // nonce
            );

            AttestationRequest memory loopRequest = AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: recipient,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: loopAttestationData,
                    value: 0
                })
            });

            eas.attest(loopRequest);
        }

        assertEq(feeGate.attestCount(issuer), 2);
        assertFalse(feeGate.hasPaidFee(issuer));

        // Third attestation - should require 100 GLMR fee
        bytes memory attestationData = abi.encode(
            'cubid3',
            uint8(5),
            true,
            bytes32(uint256(1)),
            uint64(block.timestamp),
            uint64(0),
            uint256(2) // nonce
        );

        AttestationRequest memory request = AttestationRequest({
            schema: schemaUID,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: attestationData,
                value: feeGate.LIFETIME_FEE()
            })
        });

        // Should succeed with fee
        eas.attest{value: feeGate.LIFETIME_FEE()}(request);

        assertEq(feeGate.attestCount(issuer), 3);
        assertTrue(feeGate.hasPaidFee(issuer));

        // Fourth attestation should not require fee
        attestationData = abi.encode(
            'cubid4',
            uint8(5),
            true,
            bytes32(uint256(1)),
            uint64(block.timestamp),
            uint64(0),
            uint256(3) // nonce
        );
        request.data.data = attestationData;
        request.data.value = 0;

        eas.attest(request);
        assertEq(feeGate.attestCount(issuer), 4);

        vm.stopPrank();
    }

    function testInsufficientFee() public {
        vm.startPrank(issuer);

        // Make first two attestations
        for (uint256 i = 0; i < 2; i++) {
            bytes memory loopAttestationData = abi.encode(
                string(abi.encodePacked('cubid', vm.toString(i))),
                uint8(5),
                true,
                bytes32(uint256(1)),
                uint64(block.timestamp),
                uint64(0),
                i
            );

            AttestationRequest memory loopRequest = AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: recipient,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: loopAttestationData,
                    value: 0
                })
            });

            eas.attest(loopRequest);
        }

        // Try third attestation with insufficient fee
        bytes memory attestationData = abi.encode(
            'cubid3',
            uint8(5),
            true,
            bytes32(uint256(1)),
            uint64(block.timestamp),
            uint64(0),
            uint256(2)
        );

        AttestationRequest memory request = AttestationRequest({
            schema: schemaUID,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: attestationData,
                value: 50 ether // Less than LIFETIME_FEE
            })
        });

        vm.expectRevert(FeeGate.InsufficientFee.selector);
        eas.attest{value: 50 ether}(request);

        vm.stopPrank();
    }

    function testLastUIDAnchor() public {
        vm.startPrank(issuer);

        string memory cubidId = 'cubid123';

        bytes memory attestationData = abi.encode(
            cubidId,
            uint8(5),
            true,
            bytes32(uint256(1)),
            uint64(block.timestamp),
            uint64(0),
            uint256(0)
        );

        AttestationRequest memory request = AttestationRequest({
            schema: schemaUID,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: attestationData,
                value: 0
            })
        });

        bytes32 uid1 = eas.attest(request);

        // Check lastUID was set
        assertEq(feeGate.getLastUID(issuer, cubidId), uid1);

        // Make another attestation for same cubidId
        attestationData = abi.encode(
            cubidId,
            uint8(7),
            true,
            bytes32(uint256(1)),
            uint64(block.timestamp),
            uint64(0),
            uint256(1)
        );
        request.data.data = attestationData;

        bytes32 uid2 = eas.attest(request);

        // LastUID should be updated to latest
        assertEq(feeGate.getLastUID(issuer, cubidId), uid2);

        vm.stopPrank();
    }
}

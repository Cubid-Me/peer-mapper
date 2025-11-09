// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from 'forge-std/Test.sol';
import {FeeGate, AttestationPayload} from '../src/FeeGate.sol';
import {SchemaRegistry} from 'eas-contracts/SchemaRegistry.sol';
import {EAS} from 'eas-contracts/EAS.sol';
import {Signature} from 'eas-contracts/Common.sol';
import {IEAS} from 'eas-contracts/IEAS.sol';
import {ISchemaResolver} from 'eas-contracts/resolver/ISchemaResolver.sol';

contract FeeGateTest is Test {
    FeeGate public feeGate;
    SchemaRegistry public registry;
    EAS public eas;
    bytes32 public schemaUID;

    uint256 private constant ISSUER_KEY = 0xA11CE;
    address public issuer = vm.addr(ISSUER_KEY);
    address public recipient = address(0xBEEF);

    receive() external payable {}

    string constant SCHEMA =
        'string cubidId,uint8 trustLevel,bool human,bytes32 circle,uint64 issuedAt,uint64 expiry,uint256 nonce';

    function setUp() public {
        registry = new SchemaRegistry();
        eas = new EAS(registry);

        address predictedFeeGate = vm.computeCreateAddress(
            address(this),
            vm.getNonce(address(this))
        );
        schemaUID = registry.register(SCHEMA, ISchemaResolver(predictedFeeGate), true);
        feeGate = new FeeGate(IEAS(address(eas)), schemaUID);

        // Verify predicted address matches deployed address
        assertEq(
            address(feeGate),
            predictedFeeGate,
            'FeeGate address prediction failed - setUp() modified before deployment'
        );

        vm.deal(issuer, 1_000 ether);
    }

    function testAttestDirectNoFee() public {
        vm.startPrank(issuer);
        AttestationPayload memory payload = _payload('cubid123', 5);
        bytes32 uid = feeGate.attestDirect(payload);
        vm.stopPrank();

        assertEq(feeGate.attestCount(issuer), 1);
        assertEq(feeGate.issuerNonce(issuer), 1);
        assertFalse(feeGate.hasPaidFee(issuer));
        assertEq(feeGate.getLastUID(issuer, 'cubid123'), uid);
        assertEq(address(feeGate).balance, 0);
    }

    function testDelegatedAttestationSuccess() public {
        AttestationPayload memory payload = _payload('cubid456', 4);
        uint256 nonce = feeGate.issuerNonce(issuer);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        Signature memory signature = _signPayload(payload, nonce, deadline);

        bytes32 uid = feeGate.attestDelegated(payload, issuer, nonce, deadline, signature);

        assertEq(feeGate.attestCount(issuer), 1);
        assertEq(feeGate.issuerNonce(issuer), 1);
        assertEq(feeGate.getLastUID(issuer, 'cubid456'), uid);
    }

    function testDelegatedInvalidNonceReverts() public {
        AttestationPayload memory payload = _payload('cubid789', 3);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        Signature memory signature = _signPayload(payload, 1, deadline);

        vm.expectRevert(FeeGate.InvalidNonce.selector);
        feeGate.attestDelegated(payload, issuer, 1, deadline, signature);
    }

    function testDelegatedDeadlineExpiredReverts() public {
        AttestationPayload memory payload = _payload('cubid987', 3);
        uint256 nonce = feeGate.issuerNonce(issuer);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        Signature memory signature = _signPayload(payload, nonce, deadline);

        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(FeeGate.DeadlineExpired.selector);
        feeGate.attestDelegated(payload, issuer, nonce, deadline, signature);
    }

    function testFeeChargedOnThirdAttestation() public {
        // first attestation (direct)
        vm.startPrank(issuer);
        feeGate.attestDirect(_payload('cubidA', 5));
        vm.stopPrank();

        // second attestation (delegated)
        AttestationPayload memory payload = _payload('cubidB', 4);
        uint256 nonce = feeGate.issuerNonce(issuer);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        Signature memory signature = _signPayload(payload, nonce, deadline);
        feeGate.attestDelegated(payload, issuer, nonce, deadline, signature);

        assertEq(feeGate.attestCount(issuer), 2);
        assertFalse(feeGate.hasPaidFee(issuer));
        assertEq(address(feeGate).balance, 0);

        // third attestation must pay fee
        vm.startPrank(issuer);
        vm.expectRevert(FeeGate.InsufficientFee.selector);
        feeGate.attestDirect(_payload('cubidC', 6));
        vm.stopPrank();

        vm.startPrank(issuer);
        bytes32 uid = feeGate.attestDirect{value: feeGate.lifetimeFee()}(_payload('cubidC', 6));
        vm.stopPrank();

        assertEq(feeGate.attestCount(issuer), 3);
        assertTrue(feeGate.hasPaidFee(issuer));
        assertEq(feeGate.getLastUID(issuer, 'cubidC'), uid);
        assertEq(address(feeGate).balance, feeGate.lifetimeFee());

        // fourth attestation requires no additional fee
        AttestationPayload memory payloadFourth = _payload('cubidD', 7);
        uint256 nonceFourth = feeGate.issuerNonce(issuer);
        uint64 deadlineFourth = uint64(block.timestamp + 1 hours);
        Signature memory signatureFourth = _signPayload(payloadFourth, nonceFourth, deadlineFourth);
        feeGate.attestDelegated(
            payloadFourth,
            issuer,
            nonceFourth,
            deadlineFourth,
            signatureFourth
        );

        assertEq(feeGate.attestCount(issuer), 4);
        assertTrue(feeGate.hasPaidFee(issuer));
        assertEq(address(feeGate).balance, feeGate.lifetimeFee());
    }

    function testInsufficientFeeDelegatedReverts() public {
        // two free attestations
        vm.startPrank(issuer);
        feeGate.attestDirect(_payload('cubidFree1', 5));
        feeGate.attestDirect(_payload('cubidFree2', 5));
        vm.stopPrank();

        AttestationPayload memory payload = _payload('cubidFee', 5);
        uint256 nonce = feeGate.issuerNonce(issuer);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        Signature memory signature = _signPayload(payload, nonce, deadline);

        vm.expectRevert(FeeGate.InsufficientFee.selector);
        feeGate.attestDelegated(payload, issuer, nonce, deadline, signature);
    }

    function testLastUIDAnchorUpdates() public {
        vm.startPrank(issuer);
        feeGate.attestDirect(_payload('cubidX', 5));
        vm.stopPrank();

        AttestationPayload memory payload = _payload('cubidX', 6);
        uint256 nonce = feeGate.issuerNonce(issuer);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        Signature memory signature = _signPayload(payload, nonce, deadline);
        bytes32 latestUID = feeGate.attestDelegated(payload, issuer, nonce, deadline, signature);

        assertEq(feeGate.getLastUID(issuer, 'cubidX'), latestUID);
    }

    function testSetLifetimeFeeByDeployer() public {
        uint256 oldFee = feeGate.lifetimeFee();
        assertEq(oldFee, 100 ether);

        uint256 newFee = 50 ether;
        feeGate.setLifetimeFee(newFee);

        assertEq(feeGate.lifetimeFee(), newFee);

        // Verify new fee is enforced
        vm.startPrank(issuer);
        feeGate.attestDirect(_payload('cubid1', 5));
        feeGate.attestDirect(_payload('cubid2', 5));

        // Third attestation should now require the new fee amount
        vm.expectRevert(FeeGate.InsufficientFee.selector);
        feeGate.attestDirect{value: oldFee}(_payload('cubid3', 6));

        // Should succeed with new fee
        feeGate.attestDirect{value: newFee}(_payload('cubid3', 6));
        vm.stopPrank();

        assertTrue(feeGate.hasPaidFee(issuer));
        assertEq(address(feeGate).balance, newFee);
    }

    function testSetLifetimeFeeRevertsForNonDeployer() public {
        vm.prank(issuer);
        vm.expectRevert(FeeGate.OnlyDeployer.selector);
        feeGate.setLifetimeFee(50 ether);
    }

    function testSetLifetimeFeeRevertsForZero() public {
        vm.expectRevert(FeeGate.InvalidFee.selector);
        feeGate.setLifetimeFee(0);
    }

    function testWithdrawByDeployer() public {
        // Setup: get issuer to pay fee
        vm.startPrank(issuer);
        feeGate.attestDirect(_payload('cubid1', 5));
        feeGate.attestDirect(_payload('cubid2', 5));
        feeGate.attestDirect{value: feeGate.lifetimeFee()}(_payload('cubid3', 6));
        vm.stopPrank();

        uint256 contractBalance = address(feeGate).balance;
        assertEq(contractBalance, 100 ether);

        uint256 deployerBalanceBefore = address(this).balance;
        feeGate.withdraw();
        uint256 deployerBalanceAfter = address(this).balance;

        assertEq(address(feeGate).balance, 0);
        assertEq(deployerBalanceAfter - deployerBalanceBefore, contractBalance);
    }

    function testWithdrawRevertsForNonDeployer() public {
        vm.prank(issuer);
        vm.expectRevert(FeeGate.OnlyDeployer.selector);
        feeGate.withdraw();
    }

    function _payload(
        string memory cubidId,
        uint8 trustLevel
    ) internal view returns (AttestationPayload memory payload) {
        payload = AttestationPayload({
            recipient: recipient,
            refUID: bytes32(0),
            revocable: true,
            expirationTime: 0,
            cubidId: cubidId,
            trustLevel: trustLevel,
            human: true,
            circle: bytes32(uint256(1)),
            issuedAt: uint64(block.timestamp),
            expiry: uint64(0)
        });
    }

    function _signPayload(
        AttestationPayload memory payload,
        uint256 nonce,
        uint64 deadline
    ) internal view returns (Signature memory signature) {
        bytes32 digest = feeGate.hashAttestation(
            issuer,
            payload.recipient,
            payload.refUID,
            payload.revocable,
            payload.expirationTime,
            payload.cubidId,
            payload.trustLevel,
            payload.human,
            payload.circle,
            payload.issuedAt,
            payload.expiry,
            nonce,
            deadline
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ISSUER_KEY, digest);
        signature = Signature({v: v, r: r, s: s});
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// solhint-disable no-console

import {Script} from 'forge-std/Script.sol';
import {console2} from 'forge-std/console2.sol';
import {IEAS} from 'eas-contracts/IEAS.sol';
import {FeeGate} from '../src/FeeGate.sol';

contract DeployFeeGate is Script {
    function run() external returns (FeeGate feeGate) {
        uint256 deployerKey = vm.envUint('PRIVATE_KEY_DEPLOYER');
        address easAddress = vm.envAddress('EAS_ADDRESS');
        bytes32 schemaUID = vm.envBytes32('SCHEMA_UID');

        vm.startBroadcast(deployerKey);

        feeGate = new FeeGate(IEAS(easAddress), schemaUID);
        console2.log('FeeGate deployed', address(feeGate));
        console2.log('Bound to EAS', easAddress);
        console2.logBytes32(schemaUID);

        vm.stopBroadcast();
    }
}

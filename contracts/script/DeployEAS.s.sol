// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// solhint-disable no-console

import {Script} from 'forge-std/Script.sol';
import {console2} from 'forge-std/console2.sol';
import {SchemaRegistry} from 'eas-contracts/SchemaRegistry.sol';
import {EAS} from 'eas-contracts/EAS.sol';

contract DeployEAS is Script {
    function run() external returns (SchemaRegistry registry, EAS eas) {
        uint256 deployerKey = vm.envUint('PRIVATE_KEY_DEPLOYER');

        vm.startBroadcast(deployerKey);

        registry = new SchemaRegistry();
        console2.log('SchemaRegistry deployed', address(registry));

        eas = new EAS(registry);
        console2.log('EAS deployed', address(eas));

        vm.stopBroadcast();
    }
}

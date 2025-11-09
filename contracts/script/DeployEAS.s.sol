// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// solhint-disable no-console

import {Script} from 'forge-std/Script.sol';
import {console2} from 'forge-std/console2.sol';
import {SchemaRegistry} from 'eas-contracts/SchemaRegistry.sol';
import {EAS} from 'eas-contracts/EAS.sol';
import {stdJson} from 'forge-std/StdJson.sol';

contract DeployEAS is Script {
    using stdJson for string;

    function run() external returns (SchemaRegistry registry, EAS eas) {
        uint256 deployerKey = vm.envUint('PRIVATE_KEY_DEPLOYER');
        string memory network = _getNetwork();

        vm.startBroadcast(deployerKey);

        registry = new SchemaRegistry();
        console2.log('SchemaRegistry deployed', address(registry));

        eas = new EAS(registry);
        console2.log('EAS deployed', address(eas));

        vm.stopBroadcast();

        // Update addresses.json after successful deployment
        _updateAddressesJson(network, address(registry), address(eas));
    }

    function _getNetwork() internal view returns (string memory) {
        uint256 chainId = block.chainid;
        if (chainId == 1284) return 'moonbeam';
        if (chainId == 1287) return 'moonbase-alpha';
        if (chainId == 31337) return 'localhost';
        revert('Unsupported network');
    }

    function _updateAddressesJson(
        string memory network,
        address registryAddr,
        address easAddr
    ) internal {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/../addresses.json');
        string memory json = vm.readFile(path);

        // Build the path to update
        string memory basePath = string.concat('.networks.', network, '.deployments.current');

        // Update timestamp (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ)
        string memory timestamp = _getTimestamp();
        vm.writeJson(timestamp, path, string.concat(basePath, '.timestamp'));

        // Update contract addresses
        vm.writeJson(vm.toString(registryAddr), path, string.concat(basePath, '.SchemaRegistry'));
        vm.writeJson(vm.toString(easAddr), path, string.concat(basePath, '.EAS'));

        console2.log('Updated addresses.json for network:', network);
    }

    function _getTimestamp() internal view returns (string memory) {
        // Format: YYYY-MM-DDTHH:MM:SSZ
        // Note: Solidity doesn't have date formatting, so we use block.timestamp
        // In practice, you might want to add a helper or use off-chain formatting
        return vm.toString(block.timestamp);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// solhint-disable no-console

import {Script} from 'forge-std/Script.sol';
import {console2} from 'forge-std/console2.sol';
import {IEAS} from 'eas-contracts/IEAS.sol';
import {FeeGate} from '../src/FeeGate.sol';
import {stdJson} from 'forge-std/StdJson.sol';

contract DeployFeeGate is Script {
    using stdJson for string;

    function run() external returns (FeeGate feeGate) {
        uint256 deployerKey = vm.envUint('PRIVATE_KEY_DEPLOYER');
        string memory network = _getNetwork();

        // Read EAS address and schema UID from addresses.json
        address easAddress = _getEASAddress(network);
        bytes32 schemaUID = _getSchemaUID(network);

        console2.log('Using EAS at', easAddress);
        console2.log('Using schema UID:');
        console2.logBytes32(schemaUID);

        vm.startBroadcast(deployerKey);

        feeGate = new FeeGate(IEAS(easAddress), schemaUID);
        console2.log('FeeGate deployed at', address(feeGate));

        vm.stopBroadcast();

        // Update addresses.json with FeeGate address
        _updateAddressesJson(network, address(feeGate));
    }

    function _getNetwork() internal view returns (string memory) {
        uint256 chainId = block.chainid;
        if (chainId == 1284) return 'moonbeam';
        if (chainId == 1287) return 'moonbase-alpha';
        if (chainId == 31337) return 'localhost';
        revert('Unsupported network');
    }

    function _getEASAddress(string memory network) internal view returns (address) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/addresses.json');
        string memory json = vm.readFile(path);

        string memory key = string.concat('.networks.', network, '.deployments.current.EAS');
        return json.readAddress(key);
    }

    function _getSchemaUID(string memory network) internal view returns (bytes32) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/addresses.json');
        string memory json = vm.readFile(path);

        string memory key = string.concat(
            '.networks.',
            network,
            '.deployments.current.schemas.CubidTrust.uid'
        );
        return json.readBytes32(key);
    }

    function _updateAddressesJson(string memory network, address feeGateAddress) internal {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/addresses.json');

        string memory basePath = string.concat('.networks.', network, '.deployments.current');

        // Update FeeGate address
        vm.writeJson(vm.toString(feeGateAddress), path, string.concat(basePath, '.FeeGate'));

        // Also update the schema resolver reference to point to FeeGate
        vm.writeJson(
            vm.toString(feeGateAddress),
            path,
            string.concat(basePath, '.schemas.CubidTrust.resolver')
        );

        console2.log('Updated addresses.json with FeeGate address');
    }
}

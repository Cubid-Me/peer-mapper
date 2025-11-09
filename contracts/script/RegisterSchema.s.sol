// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// solhint-disable no-console

import {Script} from 'forge-std/Script.sol';
import {console2} from 'forge-std/console2.sol';
import {ISchemaRegistry} from 'eas-contracts/ISchemaRegistry.sol';
import {ISchemaResolver} from 'eas-contracts/resolver/ISchemaResolver.sol';
import {stdJson} from 'forge-std/StdJson.sol';

contract RegisterSchema is Script {
    using stdJson for string;

    string public constant SCHEMA_NAME = 'CubidTrust';
    // solhint-disable-next-line gas-small-strings
    string public constant SCHEMA =
        'string cubidId,uint8 trustLevel,bool human,bytes32 circle,uint64 issuedAt,uint64 expiry,uint256 nonce';

    function run() external returns (bytes32 schemaUid) {
        uint256 deployerKey = vm.envUint('PRIVATE_KEY_DEPLOYER');
        string memory network = _getNetwork();

        // Read SchemaRegistry address from addresses.json
        address registryAddress = _getRegistryAddress(network);
        console2.log('Using SchemaRegistry at', registryAddress);

        // Get resolver address (optional, defaults to address(0))
        address resolverAddress = _getResolverAddress(network);
        ISchemaResolver resolver = ISchemaResolver(resolverAddress);

        bool revocable = vm.envOr('SCHEMA_REVOCABLE', true);

        vm.startBroadcast(deployerKey);

        schemaUid = ISchemaRegistry(registryAddress).register(SCHEMA, resolver, revocable);
        console2.log('Registered schema', SCHEMA_NAME);
        console2.logBytes32(schemaUid);

        vm.stopBroadcast();

        // Update addresses.json with schema UID
        _updateAddressesJson(network, schemaUid, resolverAddress, revocable);
    }

    function _getNetwork() internal view returns (string memory) {
        uint256 chainId = block.chainid;
        if (chainId == 1284) return 'moonbeam';
        if (chainId == 1287) return 'moonbase-alpha';
        if (chainId == 31337) return 'localhost';
        revert('Unsupported network');
    }

    function _getRegistryAddress(string memory network) internal view returns (address) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/../addresses.json');
        string memory json = vm.readFile(path);

        string memory key = string.concat(
            '.networks.',
            network,
            '.deployments.current.SchemaRegistry'
        );
        return json.readAddress(key);
    }

    function _getResolverAddress(string memory network) internal view returns (address) {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/../addresses.json');
        string memory json = vm.readFile(path);

        string memory key = string.concat('.networks.', network, '.deployments.current.FeeGate');

        // Try to read FeeGate address, return address(0) if not found
        try vm.parseJsonAddress(json, key) returns (address addr) {
            return addr;
        } catch {
            return address(0);
        }
    }

    function _updateAddressesJson(
        string memory network,
        bytes32 schemaUid,
        address resolver,
        bool revocable
    ) internal {
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, '/../addresses.json');

        string memory basePath = string.concat(
            '.networks.',
            network,
            '.deployments.current.schemas.',
            SCHEMA_NAME
        );

        // Update schema details
        vm.writeJson(vm.toString(schemaUid), path, string.concat(basePath, '.uid'));
        vm.writeJson(vm.toString(resolver), path, string.concat(basePath, '.resolver'));
        vm.writeJson(revocable ? 'true' : 'false', path, string.concat(basePath, '.revocable'));

        console2.log('Updated addresses.json with schema UID');
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// solhint-disable no-console

import {Script} from 'forge-std/Script.sol';
import {console2} from 'forge-std/console2.sol';
import {ISchemaRegistry} from 'eas-contracts/ISchemaRegistry.sol';
import {ISchemaResolver} from 'eas-contracts/resolver/ISchemaResolver.sol';

contract RegisterSchema is Script {
    string public constant SCHEMA_NAME = 'CubidTrust';
    // solhint-disable-next-line gas-small-strings
    string public constant SCHEMA =
        'string cubidId,uint8 trustLevel,bool human,bytes32 circle,uint64 issuedAt,uint64 expiry,uint256 nonce';

    function run() external returns (bytes32 schemaUid) {
        uint256 deployerKey = vm.envUint('PRIVATE_KEY_DEPLOYER');
        address registryAddress = vm.envAddress('SCHEMA_REGISTRY_ADDRESS');
        ISchemaResolver resolver = ISchemaResolver(vm.envOr('SCHEMA_RESOLVER_ADDRESS', address(0)));
        bool revocable = vm.envOr('SCHEMA_REVOCABLE', true);

        vm.startBroadcast(deployerKey);

        schemaUid = ISchemaRegistry(registryAddress).register(SCHEMA, resolver, revocable);
        console2.log('Registered schema', SCHEMA_NAME);
        console2.logBytes32(schemaUid);

        vm.stopBroadcast();
    }
}

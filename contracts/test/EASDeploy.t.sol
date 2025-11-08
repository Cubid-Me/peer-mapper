// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import 'forge-std/Test.sol';
import 'eas-contracts/SchemaRegistry.sol';
import 'eas-contracts/EAS.sol';

contract EASDeployTest is Test {
    function testDeploysRegistryAndEAS() public {
        SchemaRegistry registry = new SchemaRegistry();
        EAS eas = new EAS(registry);

        assertEq(address(eas.getSchemaRegistry()), address(registry));
        assertEq(registry.version(), '1.4.0');
        assertEq(eas.version(), '1.4.0');
    }
}

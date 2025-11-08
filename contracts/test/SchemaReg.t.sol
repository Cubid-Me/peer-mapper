// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import 'forge-std/Test.sol';
import 'eas-contracts/SchemaRegistry.sol';
import {ISchemaRegistry, SchemaRecord} from 'eas-contracts/ISchemaRegistry.sol';
import 'eas-contracts/resolver/ISchemaResolver.sol';

contract SchemaRegTest is Test {
    string constant SCHEMA =
        'string cubidId,uint8 trustLevel,bool human,bytes32 circle,uint64 issuedAt,uint64 expiry,uint256 nonce';

    function testRegistersSchema() public {
        SchemaRegistry registry = new SchemaRegistry();
        bytes32 uid = registry.register(SCHEMA, ISchemaResolver(address(0)), true);

        SchemaRecord memory record = registry.getSchema(uid);
        assertEq(record.uid, uid);
        assertEq(record.schema, SCHEMA);
        assertEq(address(record.resolver), address(0));
        assertTrue(record.revocable);
    }

    function testRevertsOnDuplicate() public {
        SchemaRegistry registry = new SchemaRegistry();
        registry.register(SCHEMA, ISchemaResolver(address(0)), true);

        vm.expectRevert(SchemaRegistry.AlreadyExists.selector);
        registry.register(SCHEMA, ISchemaResolver(address(0)), true);
    }
}

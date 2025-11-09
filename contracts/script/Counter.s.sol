// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script} from 'forge-std/Script.sol';
import {Counter} from '../Counter.sol';

contract CounterScript is Script {
    Counter public counter;

    function setUp() public {
        /* no-op setup for script */
    }

    function run() public {
        vm.startBroadcast();

        counter = new Counter();

        vm.stopBroadcast();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {ReliefLedger} from "../src/ReliefLedger.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployScript is Script {
    uint256 public constant MIN_DONATION = 1e6; // 1 USDC

    function run() external returns (MockUSDC usdc, ReliefLedger ledger) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        usdc = new MockUSDC();
        ledger = new ReliefLedger(IERC20(address(usdc)), MIN_DONATION);

        vm.stopBroadcast();

        console.log("MockUSDC deployed at:", address(usdc));
        console.log("ReliefLedger deployed at:", address(ledger));
        console.log("Chain ID:", block.chainid);
        console.log("Deploy block:", block.number);
    }
}

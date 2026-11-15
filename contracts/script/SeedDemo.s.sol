// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ReliefLedger} from "../src/ReliefLedger.sol";
import {IReliefLedger} from "../src/interfaces/IReliefLedger.sol";

contract SeedDemoScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address ledgerAddr = vm.envAddress("RELIEF_LEDGER_ADDRESS");
        address organizer = vm.envOr("DEMO_ORGANIZER", vm.addr(deployerKey));

        ReliefLedger ledger = ReliefLedger(ledgerAddr);

        // Demo vendor addresses (deterministic testnet addresses)
        address vendor1 = vm.envOr("DEMO_VENDOR_1", address(0x1000000000000000000000000000000000000001));
        address vendor2 = vm.envOr("DEMO_VENDOR_2", address(0x1000000000000000000000000000000000000002));
        address vendor3 = vm.envOr("DEMO_VENDOR_3", address(0x1000000000000000000000000000000000000003));

        // 5 demo verifiers (must not equal organizer)
        address[] memory verifiers = new address[](5);
        verifiers[0] = address(0x2000000000000000000000000000000000000001);
        verifiers[1] = address(0x2000000000000000000000000000000000000002);
        verifiers[2] = address(0x2000000000000000000000000000000000000003);
        verifiers[3] = address(0x2000000000000000000000000000000000000004);
        verifiers[4] = address(0x2000000000000000000000000000000000000005);

        uint16[] memory bps = new uint16[](3);
        bps[0] = 3000;
        bps[1] = 3500;
        bps[2] = 3500;

        vm.startBroadcast(deployerKey);

        ledger.setVendor(vendor1, true);
        ledger.setVendor(vendor2, true);
        ledger.setVendor(vendor3, true);

        uint256 campaignId = ledger.createCampaign(
            IReliefLedger.CreateParams({
                organizer: organizer,
                minGoal: 5000e6,
                donationDeadline: uint64(block.timestamp) + 2 days,
                verifiers: verifiers,
                threshold: 3,
                challengePeriod: 24 hours,
                stallTimeout: 14 days,
                milestoneBps: bps,
                metadataCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
            })
        );

        vm.stopBroadcast();

        console.log("Seeded 3 vendors and campaign ID:", campaignId);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReliefLedger} from "../../src/ReliefLedger.sol";
import {IReliefLedger} from "../../src/interfaces/IReliefLedger.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";

contract Handler is Test {
    ReliefLedger public ledger;
    MockUSDC public usdc;
    address public admin;
    address public organizer;
    address public vendor;
    address[5] public verifiers;
    address[4] public donors;

    struct ExecutedGhost {
        uint256 requestId;
        uint8 approvals;
        uint8 threshold;
        uint64 approvedAt;
        uint64 challengePeriod;
        uint64 executedAt;
    }

    ExecutedGhost[] public executedGhosts;
    mapping(uint256 => uint8) public maxObservedStatus;

    bool public adminReducedBalance;

    constructor(
        ReliefLedger _ledger,
        MockUSDC _usdc,
        address _admin,
        address _organizer,
        address _vendor,
        address[5] memory _verifiers,
        address[4] memory _donors
    ) {
        ledger = _ledger;
        usdc = _usdc;
        admin = _admin;
        organizer = _organizer;
        vendor = _vendor;
        verifiers = _verifiers;
        donors = _donors;
    }

    function _campaignId(uint256 seed) internal view returns (uint256) {
        uint256 count = ledger.campaignCount();
        if (count == 0) return 0;
        return (seed % count) + 1;
    }

    function _recordStatus(uint256 id) internal {
        if (id == 0) return;
        uint8 s = uint8(ledger.getCampaign(id).status);
        if (s > maxObservedStatus[id]) {
            maxObservedStatus[id] = s;
        }
    }

    function createCampaign(uint256 goalSeed) external {
        if (ledger.campaignCount() >= 5) return;
        uint256 goal = bound(goalSeed, 100e6, 5000e6);

        address[] memory v = new address[](5);
        for (uint256 i; i < 5; ++i) {
            v[i] = verifiers[i];
        }

        uint16[] memory bps = new uint16[](3);
        bps[0] = 3000;
        bps[1] = 3000;
        bps[2] = 4000;

        IReliefLedger.CreateParams memory p = IReliefLedger.CreateParams({
            organizer: organizer,
            minGoal: goal,
            donationDeadline: uint64(block.timestamp) + 7 days,
            verifiers: v,
            threshold: 3,
            challengePeriod: 24 hours,
            stallTimeout: 14 days,
            milestoneBps: bps,
            metadataCid: "ipfs://QmInvariant"
        });

        vm.prank(admin);
        try ledger.createCampaign(p) returns (uint256 id) {
            _recordStatus(id);
        } catch {}
    }

    function donate(uint256 idSeed, uint256 donorSeed, uint256 amountSeed) external {
        uint256 id = _campaignId(idSeed);
        if (id == 0) return;
        address donor = donors[donorSeed % donors.length];
        uint256 amount = bound(amountSeed, 1e6, 2000e6);

        usdc.mint(donor, amount);
        vm.startPrank(donor);
        usdc.approve(address(ledger), amount);
        try ledger.donate(id, amount) {} catch {}
        vm.stopPrank();
        _recordStatus(id);
    }

    function finalize(uint256 idSeed) external {
        uint256 id = _campaignId(idSeed);
        if (id == 0) return;
        try ledger.finalizeFundraising(id) {} catch {}
        _recordStatus(id);
    }

    function proposePayout(uint256 idSeed, uint256 amountSeed) external {
        uint256 id = _campaignId(idSeed);
        if (id == 0) return;
        IReliefLedger.Campaign memory c = ledger.getCampaign(id);
        if (c.currentAvailable == 0) return;
        uint256 amount = bound(amountSeed, 1e6, c.currentAvailable);

        vm.prank(organizer);
        try ledger.proposePayout(id, vendor, amount, "ipfs://QmInvInvoice") {} catch {}
    }

    function approvePayout(uint256 reqSeed, uint256 verifierSeed) external {
        uint256 reqCount = ledger.requestCount();
        if (reqCount == 0) return;
        uint256 reqId = (reqSeed % reqCount) + 1;
        address v = verifiers[verifierSeed % verifiers.length];

        vm.prank(v);
        try ledger.approvePayout(reqId) {} catch {}
    }

    function vetoPayout(uint256 reqSeed, uint256 verifierSeed) external {
        uint256 reqCount = ledger.requestCount();
        if (reqCount == 0) return;
        uint256 reqId = (reqSeed % reqCount) + 1;
        address v = verifiers[verifierSeed % verifiers.length];

        vm.prank(v);
        try ledger.vetoPayout(reqId, "ipfs://QmVetoReason") {} catch {}
    }

    function cancelPayout(uint256 reqSeed) external {
        uint256 reqCount = ledger.requestCount();
        if (reqCount == 0) return;
        uint256 reqId = (reqSeed % reqCount) + 1;

        vm.prank(organizer);
        try ledger.cancelPayout(reqId) {} catch {}
    }

    function executePayout(uint256 reqSeed) external {
        uint256 reqCount = ledger.requestCount();
        if (reqCount == 0) return;
        uint256 reqId = (reqSeed % reqCount) + 1;

        IReliefLedger.PayoutRequest memory r = ledger.getRequest(reqId);
        IReliefLedger.Campaign memory c = ledger.getCampaign(r.campaignId);

        try ledger.executePayout(reqId) {
            executedGhosts.push(
                ExecutedGhost({
                    requestId: reqId,
                    approvals: r.approvals,
                    threshold: c.threshold,
                    approvedAt: r.approvedAt,
                    challengePeriod: c.challengePeriod,
                    executedAt: uint64(block.timestamp)
                })
            );
        } catch {}
    }

    function submitDelivery(uint256 idSeed) external {
        uint256 id = _campaignId(idSeed);
        if (id == 0) return;

        vm.prank(organizer);
        try ledger.submitDelivery(id, "ipfs://QmDelivery") {} catch {}
        _recordStatus(id);
    }

    function triggerStallRefund(uint256 idSeed) external {
        uint256 id = _campaignId(idSeed);
        if (id == 0) return;

        try ledger.triggerStallRefund(id) {} catch {}
        _recordStatus(id);
    }

    function claimRefund(uint256 idSeed, uint256 donorSeed) external {
        uint256 id = _campaignId(idSeed);
        if (id == 0) return;
        address donor = donors[donorSeed % donors.length];

        vm.prank(donor);
        try ledger.claimRefund(id) {} catch {}
    }

    function warpTime(uint256 deltaSeed) external {
        uint256 delta = bound(deltaSeed, 1 hours, 15 days);
        vm.warp(block.timestamp + delta);
    }

    function ownerActions(uint256 actionSeed) external {
        uint256 balBefore = usdc.balanceOf(address(ledger));
        vm.startPrank(admin);
        uint256 act = actionSeed % 4;
        if (act == 0) {
            try ledger.pause() {} catch {}
        } else if (act == 1) {
            try ledger.unpause() {} catch {}
        } else if (act == 2) {
            try ledger.setVendor(vendor, true) {} catch {}
        } else {
            try ledger.setVendor(vendor, false) {} catch {}
        }
        vm.stopPrank();
        uint256 balAfter = usdc.balanceOf(address(ledger));
        if (balAfter < balBefore) {
            adminReducedBalance = true;
        }
    }

    function executedGhostCount() external view returns (uint256) {
        return executedGhosts.length;
    }
}

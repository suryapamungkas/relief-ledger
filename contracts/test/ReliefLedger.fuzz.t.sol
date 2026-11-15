// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Base} from "./utils/Base.t.sol";
import {IReliefLedger} from "../src/interfaces/IReliefLedger.sol";

contract ReliefLedgerFuzzTest is Base {
    function testFuzz_DonateSumMatchesRaised(uint96 a1, uint96 a2, uint96 a3) public {
        uint256 d1 = bound(uint256(a1), MIN_DONATION, 10_000_000e6);
        uint256 d2 = bound(uint256(a2), MIN_DONATION, 10_000_000e6);
        uint256 d3 = bound(uint256(a3), MIN_DONATION, 10_000_000e6);

        usdc.mint(donor1, d1);
        usdc.mint(donor2, d2);
        usdc.mint(donor3, d3);

        uint256 id = _createCampaign();
        _donate(id, donor1, d1);
        _donate(id, donor2, d2);
        _donate(id, donor3, d3);

        assertEq(ledger.contributions(id, donor1), d1);
        assertEq(ledger.contributions(id, donor2), d2);
        assertEq(ledger.contributions(id, donor3), d3);
        assertEq(ledger.getCampaign(id).raised, d1 + d2 + d3);
    }

    function testFuzz_MilestoneAllocationsSumToRaised(
        uint8 countRaw,
        uint16 b0,
        uint16 b1,
        uint16 b2,
        uint16 b3,
        uint96 raisedRaw
    )
        public
    {
        uint256 count = bound(uint256(countRaw), 1, 5);
        uint256 raisedAmt = bound(uint256(raisedRaw), MIN_GOAL, 100_000_000e6);

        uint16[] memory bps = new uint16[](count);
        if (count == 1) {
            bps[0] = 10_000;
        } else {
            uint16[4] memory seeds = [b0, b1, b2, b3];
            uint256 remaining = 10_000;
            for (uint256 i; i < count - 1; ++i) {
                uint256 maxForThis = remaining - (count - 1 - i);
                uint256 val = bound(uint256(seeds[i]), 1, maxForThis);
                bps[i] = uint16(val);
                remaining -= val;
            }
            bps[count - 1] = uint16(remaining);
        }

        IReliefLedger.CreateParams memory p = _defaultParams();
        p.milestoneBps = bps;
        vm.prank(admin);
        uint256 id = ledger.createCampaign(p);

        usdc.mint(donor1, raisedAmt);
        _donate(id, donor1, raisedAmt);
        _finalize(id);

        uint256[] memory allocs = ledger.getAllocations(id);
        assertEq(allocs.length, count);

        uint256 sum;
        for (uint256 i; i < count; ++i) {
            sum += allocs[i];
        }
        assertEq(sum, raisedAmt);
    }

    function testFuzz_ProRataRefundNeverExceedsRefundPool(
        uint96 d1Raw,
        uint96 d2Raw,
        uint96 d3Raw,
        uint96 disbursedRaw
    )
        public
    {
        uint256 d1 = bound(uint256(d1Raw), MIN_GOAL, 1_000_000e6);
        uint256 d2 = bound(uint256(d2Raw), MIN_DONATION, 1_000_000e6);
        uint256 d3 = bound(uint256(d3Raw), MIN_DONATION, 1_000_000e6);
        uint256 totalRaised = d1 + d2 + d3;

        usdc.mint(donor1, d1);
        usdc.mint(donor2, d2);
        usdc.mint(donor3, d3);

        uint256 id = _createCampaign();
        _donate(id, donor1, d1);
        _donate(id, donor2, d2);
        _donate(id, donor3, d3);
        _finalize(id);

        uint256 toDisburse = bound(uint256(disbursedRaw), 0, totalRaised);
        if (toDisburse > 0) {
            uint256 req = _proposePayout(id, toDisburse);
            _approveN(req, 2);
            _waitChallenge();
            ledger.executePayout(req);
        }

        vm.warp(block.timestamp + STALL + 1);
        ledger.triggerStallRefund(id);

        IReliefLedger.Campaign memory c = ledger.getCampaign(id);
        assertEq(c.refundPool, totalRaised - toDisburse);

        vm.prank(donor1);
        ledger.claimRefund(id);
        vm.prank(donor2);
        ledger.claimRefund(id);
        vm.prank(donor3);
        ledger.claimRefund(id);

        c = ledger.getCampaign(id);
        assertLe(c.refundedTotal, c.refundPool);
        assertGe(usdc.balanceOf(address(ledger)), c.raised - c.disbursed - c.refundedTotal);
    }
}

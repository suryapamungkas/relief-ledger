// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Base} from "../utils/Base.t.sol";
import {Handler} from "./Handler.sol";
import {IReliefLedger} from "../../src/interfaces/IReliefLedger.sol";

contract ReliefLedgerInvariantTest is Base {
    Handler internal handler;

    function setUp() public override {
        super.setUp();

        address[5] memory vers = [v1, v2, v3, v4, v5];
        address[4] memory dns = [donor1, donor2, donor3, makeAddr("donor4")];

        handler = new Handler(ledger, usdc, admin, organizer, vendor, vers, dns);

        // Seed 1 campaign so actions immediately interact with campaigns
        vm.prank(admin);
        IReliefLedger.CreateParams memory p = _defaultParams();
        p.verifiers = _fiveVerifiers();
        p.threshold = 3;
        p.milestoneBps = _defaultMilestoneBps3();
        ledger.createCampaign(p);

        targetContract(address(handler));
    }

    /// @notice Invariant 1: Solvency across all campaigns
    function invariant_Solvency() public view {
        uint256 count = ledger.campaignCount();
        uint256 totalLiability;
        for (uint256 id = 1; id <= count; ++id) {
            IReliefLedger.Campaign memory c = ledger.getCampaign(id);
            totalLiability += (c.raised - c.disbursed - c.refundedTotal);
        }
        assertGe(usdc.balanceOf(address(ledger)), totalLiability);
    }

    /// @notice Invariants 2, 3, 4, 7, 8 per campaign
    function invariant_CampaignAccountingAndState() public view {
        uint256 count = ledger.campaignCount();
        for (uint256 id = 1; id <= count; ++id) {
            IReliefLedger.Campaign memory c = ledger.getCampaign(id);

            // 2. disbursed <= raised
            assertLe(c.disbursed, c.raised);

            // 3. refundedTotal <= refundPool
            assertLe(c.refundedTotal, c.refundPool);

            // 4. For Refunding / Completed: disbursed + refundPool <= raised
            if (c.status == IReliefLedger.Status.Refunding || c.status == IReliefLedger.Status.Completed) {
                assertLe(c.disbursed + c.refundPool, c.raised);
            }

            // 7. Monotonic status & terminal immutability
            uint8 maxStatus = handler.maxObservedStatus(id);
            assertGe(uint8(c.status), maxStatus);

            // 8. While Active: currentAvailable + disbursed == sum of unlocked allocations
            if (c.status == IReliefLedger.Status.Active) {
                uint256[] memory allocs = ledger.getAllocations(id);
                uint256 unlockedSum;
                for (uint256 m; m <= c.currentMilestone; ++m) {
                    unlockedSum += allocs[m];
                }
                assertEq(c.currentAvailable + c.disbursed, unlockedSum);
            }
        }
    }

    /// @notice Invariant 5: No unauthorized payout
    function invariant_NoUnauthorizedPayout() public view {
        uint256 len = handler.executedGhostCount();
        for (uint256 i; i < len; ++i) {
            (, uint8 approvals, uint8 threshold, uint64 approvedAt, uint64 challengePeriod, uint64 executedAt) =
                handler.executedGhosts(i);
            assertGe(approvals, threshold);
            assertGt(approvedAt, 0);
            assertGe(executedAt, approvedAt + challengePeriod);
        }
    }

    /// @notice Invariant 6: Admin cannot extract funds
    function invariant_AdminCannotExtractFunds() public view {
        assertFalse(handler.adminReducedBalance());
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Base} from "./utils/Base.t.sol";
import {ReliefLedger} from "../src/ReliefLedger.sol";
import {IReliefLedger} from "../src/interfaces/IReliefLedger.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @dev Malicious ERC-20 that takes a 1% transfer fee to test fee-on-transfer rejection.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("FeeToken", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xdead), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract ReliefLedgerTest is Base {
    // ─── MockUSDC Tests ───

    function test_MockUSDC_DecimalsAndFaucet() public {
        assertEq(usdc.decimals(), 6);

        address user = makeAddr("faucetUser");
        vm.prank(user);
        usdc.faucet();
        assertEq(usdc.balanceOf(user), 1000e6);

        // Cooldown reverts
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.FaucetCooldown.selector, block.timestamp + 1 days));
        usdc.faucet();

        // After 1 day succeeds
        vm.warp(block.timestamp + 1 days);
        vm.prank(user);
        usdc.faucet();
        assertEq(usdc.balanceOf(user), 2000e6);
    }

    // ─── Constructor Tests ───

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(IReliefLedger.ZeroAddress.selector);
        new ReliefLedger(IERC20(address(0)), 1e6);
    }

    function test_Constructor_RevertsZeroMinDonation() public {
        vm.expectRevert(IReliefLedger.InvalidAmount.selector);
        new ReliefLedger(usdc, 0);
    }

    // ─── Admin & Ownership Tests ───

    function test_SetVendor_HappyAndEvents() public {
        address newVendor = makeAddr("newVendor");
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit IReliefLedger.VendorSet(newVendor, true);
        ledger.setVendor(newVendor, true);
        assertTrue(ledger.isVendor(newVendor));

        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit IReliefLedger.VendorSet(newVendor, false);
        ledger.setVendor(newVendor, false);
        assertFalse(ledger.isVendor(newVendor));
    }

    function test_SetVendor_Reverts() public {
        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor1));
        ledger.setVendor(makeAddr("v"), true);

        vm.prank(admin);
        vm.expectRevert(IReliefLedger.ZeroAddress.selector);
        ledger.setVendor(address(0), true);

        vm.prank(admin);
        vm.expectRevert(IReliefLedger.SelfAddress.selector);
        ledger.setVendor(address(ledger), true);
    }

    function test_Ownable2Step_AndRenounceDisabled() public {
        address newAdmin = makeAddr("newAdmin");

        vm.prank(admin);
        ledger.transferOwnership(newAdmin);
        assertEq(ledger.owner(), admin);
        assertEq(ledger.pendingOwner(), newAdmin);

        vm.prank(newAdmin);
        ledger.acceptOwnership();
        assertEq(ledger.owner(), newAdmin);

        vm.prank(newAdmin);
        vm.expectRevert(IReliefLedger.RenounceDisabled.selector);
        ledger.renounceOwnership();
    }

    function test_PauseUnpause_AccessControl() public {
        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor1));
        ledger.pause();

        vm.prank(admin);
        ledger.pause();
        assertTrue(ledger.paused());

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor1));
        ledger.unpause();

        vm.prank(admin);
        ledger.unpause();
        assertFalse(ledger.paused());
    }

    // ─── createCampaign Tests ───

    function test_CreateCampaign_Happy() public {
        IReliefLedger.CreateParams memory p = _defaultParams();
        p.verifiers = _fiveVerifiers();
        p.threshold = 3;
        p.milestoneBps = _defaultMilestoneBps3();

        vm.prank(admin);
        vm.expectEmit(true, true, false, true);
        emit IReliefLedger.CampaignCreated(
            1,
            p.organizer,
            p.verifiers,
            p.threshold,
            p.minGoal,
            p.donationDeadline,
            p.challengePeriod,
            p.stallTimeout,
            p.milestoneBps,
            p.metadataCid
        );
        uint256 id = ledger.createCampaign(p);
        assertEq(id, 1);
        assertEq(ledger.campaignCount(), 1);

        IReliefLedger.Campaign memory c = ledger.getCampaign(id);
        assertEq(c.organizer, organizer);
        assertEq(uint8(c.status), uint8(IReliefLedger.Status.Fundraising));
        assertEq(c.threshold, 3);
        assertEq(c.minGoal, MIN_GOAL);
        assertEq(c.metadataCid, "ipfs://QmFakeCid");
        assertEq(ledger.getVerifiers(id).length, 5);
        assertEq(ledger.getBps(id).length, 3);
        assertTrue(ledger.isVerifier(id, v1));
        assertTrue(ledger.isVerifier(id, v5));
    }

    function test_CreateCampaign_AllValidationReverts() public {
        // Non-owner
        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor1));
        ledger.createCampaign(_defaultParams());

        // Zero organizer
        IReliefLedger.CreateParams memory p = _defaultParams();
        p.organizer = address(0);
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.ZeroAddress.selector);
        ledger.createCampaign(p);

        // Zero goal
        p = _defaultParams();
        p.minGoal = 0;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidGoal.selector);
        ledger.createCampaign(p);

        // Deadline <= now + 1 day
        p = _defaultParams();
        p.donationDeadline = uint64(block.timestamp) + 1 days;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidDeadline.selector);
        ledger.createCampaign(p);

        // Deadline > now + MAX_FUNDRAISE
        p = _defaultParams();
        p.donationDeadline = uint64(block.timestamp) + 90 days + 1;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidDeadline.selector);
        ledger.createCampaign(p);

        // Too few verifiers
        p = _defaultParams();
        address[] memory two = new address[](2);
        two[0] = v1;
        two[1] = v2;
        p.verifiers = two;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidVerifierCount.selector);
        ledger.createCampaign(p);

        // Too many verifiers (10)
        p = _defaultParams();
        address[] memory ten = new address[](10);
        for (uint256 i; i < 10; ++i) {
            ten[i] = makeAddr(string(abi.encodePacked("v", i)));
        }
        p.verifiers = ten;
        p.threshold = 6;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidVerifierCount.selector);
        ledger.createCampaign(p);

        // Zero verifier
        p = _defaultParams();
        p.verifiers[1] = address(0);
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.ZeroAddress.selector);
        ledger.createCampaign(p);

        // Organizer as verifier
        p = _defaultParams();
        p.verifiers[1] = organizer;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.OrganizerCannotBeVerifier.selector);
        ledger.createCampaign(p);

        // Duplicate verifier
        p = _defaultParams();
        p.verifiers[2] = v1;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.DuplicateVerifier.selector);
        ledger.createCampaign(p);

        // Threshold not strict majority (1 of 3)
        p = _defaultParams();
        p.threshold = 1;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidThreshold.selector);
        ledger.createCampaign(p);

        // Threshold > verifiers.length
        p = _defaultParams();
        p.threshold = 4;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidThreshold.selector);
        ledger.createCampaign(p);

        // Challenge period too short / too long
        p = _defaultParams();
        p.challengePeriod = 24 hours - 1;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidChallengePeriod.selector);
        ledger.createCampaign(p);

        p = _defaultParams();
        p.challengePeriod = 7 days + 1;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidChallengePeriod.selector);
        ledger.createCampaign(p);

        // Stall timeout too short / too long
        p = _defaultParams();
        p.stallTimeout = 14 days - 1;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidStallTimeout.selector);
        ledger.createCampaign(p);

        p = _defaultParams();
        p.stallTimeout = 90 days + 1;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidStallTimeout.selector);
        ledger.createCampaign(p);

        // Empty milestones & >5 milestones
        p = _defaultParams();
        p.milestoneBps = new uint16[](0);
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidMilestoneCount.selector);
        ledger.createCampaign(p);

        p = _defaultParams();
        uint16[] memory six = new uint16[](6);
        for (uint256 i; i < 6; ++i) {
            six[i] = 1000;
        }
        p.milestoneBps = six;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidMilestoneCount.selector);
        ledger.createCampaign(p);

        // Zero milestone bps
        p = _defaultParams();
        uint16[] memory withZero = new uint16[](2);
        withZero[0] = 0;
        withZero[1] = 10_000;
        p.milestoneBps = withZero;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidMilestoneBps.selector);
        ledger.createCampaign(p);

        // Sum != 10000
        p = _defaultParams();
        uint16[] memory badSum = new uint16[](2);
        badSum[0] = 5000;
        badSum[1] = 4999;
        p.milestoneBps = badSum;
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.MilestoneBpsSumNot10000.selector);
        ledger.createCampaign(p);

        // Empty CID and >128 byte CID
        p = _defaultParams();
        p.metadataCid = "";
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidCidLength.selector);
        ledger.createCampaign(p);

        p = _defaultParams();
        p.metadataCid = string(new bytes(129));
        vm.prank(admin);
        vm.expectRevert(IReliefLedger.InvalidCidLength.selector);
        ledger.createCampaign(p);
    }

    // ─── Donate Tests ───

    function test_Donate_HappyAndReverts() public {
        uint256 id = _createCampaign();

        // Non-existent campaign
        vm.prank(donor1);
        vm.expectRevert(IReliefLedger.CampaignNotFound.selector);
        ledger.donate(999, 100e6);

        // Below minimum
        vm.prank(donor1);
        vm.expectRevert(IReliefLedger.DonationTooSmall.selector);
        ledger.donate(id, MIN_DONATION - 1);

        // Happy donate
        vm.startPrank(donor1);
        usdc.approve(address(ledger), 500e6);
        vm.expectEmit(true, true, false, true);
        emit IReliefLedger.Donated(id, donor1, 500e6);
        ledger.donate(id, 500e6);
        vm.stopPrank();

        assertEq(ledger.contributions(id, donor1), 500e6);
        assertEq(ledger.getCampaign(id).raised, 500e6);

        // Paused blocks donate
        vm.prank(admin);
        ledger.pause();
        vm.prank(donor2);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        ledger.donate(id, 500e6);
        vm.prank(admin);
        ledger.unpause();

        // At exact deadline reverts
        uint64 deadline = ledger.getCampaign(id).donationDeadline;
        vm.warp(deadline);
        vm.startPrank(donor2);
        usdc.approve(address(ledger), 500e6);
        vm.expectRevert(IReliefLedger.DeadlinePassed.selector);
        ledger.donate(id, 500e6);
        vm.stopPrank();

        // After finalize, donate reverts NotFundraising
        ledger.finalizeFundraising(id);
        vm.prank(donor2);
        vm.expectRevert(IReliefLedger.NotFundraising.selector);
        ledger.donate(id, 500e6);
    }

    function test_Donate_RejectsFeeOnTransferToken() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        vm.prank(admin);
        ReliefLedger feeLedger = new ReliefLedger(feeToken, 1e6);

        vm.prank(admin);
        uint256 id = feeLedger.createCampaign(_defaultParams());

        feeToken.mint(donor1, 1000e6);
        vm.startPrank(donor1);
        feeToken.approve(address(feeLedger), 100e6);
        vm.expectRevert(IReliefLedger.FeeOnTransferNotAllowed.selector);
        feeLedger.donate(id, 100e6);
        vm.stopPrank();
    }

    // ─── Finalize & Goal Not Met Refund Tests ───

    function test_FinalizeFundraising_Reverts() public {
        vm.expectRevert(IReliefLedger.CampaignNotFound.selector);
        ledger.finalizeFundraising(0);

        uint256 id = _createCampaign();
        vm.expectRevert(IReliefLedger.DeadlineNotPassed.selector);
        ledger.finalizeFundraising(id);

        _finalize(id);
        vm.expectRevert(IReliefLedger.NotFundraising.selector);
        ledger.finalizeFundraising(id);
    }

    function test_GoalNotMet_FullRefund_EvenWhenPaused() public {
        uint256 id = _createCampaign();
        _donate(id, donor1, 400e6);
        _donate(id, donor2, 500e6);

        // Pause contract — finalize and claimRefund must STILL work!
        vm.prank(admin);
        ledger.pause();

        vm.warp(block.timestamp + DONATION_WINDOW);
        ledger.finalizeFundraising(id);

        IReliefLedger.Campaign memory c = ledger.getCampaign(id);
        assertEq(uint8(c.status), uint8(IReliefLedger.Status.Refunding));
        assertEq(c.refundPool, 900e6);

        assertEq(ledger.claimableRefund(id, donor1), 400e6);
        assertEq(ledger.claimableRefund(id, donor2), 500e6);
        assertEq(ledger.claimableRefund(id, donor3), 0);

        uint256 bal1Before = usdc.balanceOf(donor1);
        vm.prank(donor1);
        vm.expectEmit(true, true, false, true);
        emit IReliefLedger.Refunded(id, donor1, 400e6);
        ledger.claimRefund(id);
        assertEq(usdc.balanceOf(donor1), bal1Before + 400e6);
        assertEq(ledger.claimableRefund(id, donor1), 0);

        // Double claim reverts
        vm.prank(donor1);
        vm.expectRevert(IReliefLedger.AlreadyRefunded.selector);
        ledger.claimRefund(id);

        // Non-donor reverts
        vm.prank(donor3);
        vm.expectRevert(IReliefLedger.NothingToRefund.selector);
        ledger.claimRefund(id);
    }

    // ─── Full Lifecycle Multi-Milestone Tests ───

    function test_FullLifecycle_MultiMilestone_WithLeftoverRefund() public {
        uint256 id = _createCampaignMultiMilestone(); // bps: 3000, 3000, 4000
        _donate(id, donor1, 600e6);
        _donate(id, donor2, 400e6); // total 1000e6 == MIN_GOAL
        _finalize(id);

        uint256[] memory allocs = ledger.getAllocations(id);
        assertEq(allocs.length, 3);
        assertEq(allocs[0], 300e6);
        assertEq(allocs[1], 300e6);
        assertEq(allocs[2], 400e6);
        assertEq(ledger.getCampaign(id).currentAvailable, 300e6);

        // Milestone 0: spend 250e6 of 300e6
        uint256 req1 = _proposePayout(id, 250e6);
        _approveN(req1, 2);
        _waitChallenge();
        ledger.executePayout(req1);
        assertEq(usdc.balanceOf(vendor), 250e6);

        // Submit delivery for milestone 0 -> unlocks milestone 1 (300e6 + 50e6 leftover = 350e6)
        vm.prank(organizer);
        vm.expectEmit(true, false, false, true);
        emit IReliefLedger.DeliverySubmitted(id, 0, "ipfs://QmDel0");
        ledger.submitDelivery(id, "ipfs://QmDel0");
        assertEq(ledger.getCampaign(id).currentMilestone, 1);
        assertEq(ledger.getCampaign(id).currentAvailable, 350e6);

        // Milestone 1: spend 300e6
        uint256 req2 = _proposePayout(id, 300e6);
        _approveN(req2, 2);
        _waitChallenge();
        ledger.executePayout(req2);

        vm.prank(organizer);
        ledger.submitDelivery(id, "ipfs://QmDel1");
        assertEq(ledger.getCampaign(id).currentMilestone, 2);
        assertEq(ledger.getCampaign(id).currentAvailable, 450e6); // 50 + 400

        // Milestone 2 (final): spend only 350e6, leaving 100e6 unspent
        uint256 req3 = _proposePayout(id, 350e6);
        _approveN(req3, 2);
        _waitChallenge();
        ledger.executePayout(req3);

        vm.prank(organizer);
        vm.expectEmit(true, false, false, true);
        emit IReliefLedger.CampaignCompleted(id, 100e6);
        ledger.submitDelivery(id, "ipfs://QmDel2");

        IReliefLedger.Campaign memory c = ledger.getCampaign(id);
        assertEq(uint8(c.status), uint8(IReliefLedger.Status.Completed));
        assertEq(c.refundPool, 100e6);
        assertEq(c.currentAvailable, 0);

        // Donors claim pro-rata refund of 100e6 leftover (donor1: 60%, donor2: 40%)
        assertEq(ledger.claimableRefund(id, donor1), 60e6);
        assertEq(ledger.claimableRefund(id, donor2), 40e6);

        vm.prank(donor1);
        ledger.claimRefund(id);
        vm.prank(donor2);
        ledger.claimRefund(id);

        assertEq(ledger.getCampaign(id).refundedTotal, 100e6);
    }

    // ─── Payout Engine Edge Cases & Reverts ───

    function test_ProposePayout_AllReverts() public {
        uint256 id = _createCampaign();

        // Not active yet
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.NotActive.selector);
        ledger.proposePayout(id, vendor, 100e6, "ipfs://inv");

        _donateFull(id);
        _finalize(id);

        // Non-organizer
        vm.prank(donor1);
        vm.expectRevert(IReliefLedger.NotOrganizer.selector);
        ledger.proposePayout(id, vendor, 100e6, "ipfs://inv");

        // Unregistered vendor
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.VendorNotRegistered.selector);
        ledger.proposePayout(id, makeAddr("unreg"), 100e6, "ipfs://inv");

        // Vendor is organizer
        vm.prank(admin);
        ledger.setVendor(organizer, true);
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.VendorIsOrganizer.selector);
        ledger.proposePayout(id, organizer, 100e6, "ipfs://inv");

        // Vendor is verifier
        vm.prank(admin);
        ledger.setVendor(v1, true);
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.VendorIsVerifier.selector);
        ledger.proposePayout(id, v1, 100e6, "ipfs://inv");

        // Amount 0 or exceeds available
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.AmountExceedsAvailable.selector);
        ledger.proposePayout(id, vendor, 0, "ipfs://inv");

        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.AmountExceedsAvailable.selector);
        ledger.proposePayout(id, vendor, MIN_GOAL + 1, "ipfs://inv");

        // Invalid CID length
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.InvalidCidLength.selector);
        ledger.proposePayout(id, vendor, 100e6, "");

        // Open request exists
        _proposePayout(id, 100e6);
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.OpenRequestExists.selector);
        ledger.proposePayout(id, vendor, 100e6, "ipfs://inv2");

        // Paused
        vm.prank(admin);
        ledger.pause();
        vm.prank(organizer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        ledger.proposePayout(id, vendor, 100e6, "ipfs://inv2");
    }

    function test_Approve_Challenge_Execute_Boundaries() public {
        uint256 id = _createCampaign();
        _donateFull(id);
        _finalize(id);
        uint256 reqId = _proposePayout(id, 500e6);

        // Non-existent request
        vm.prank(v1);
        vm.expectRevert(IReliefLedger.RequestNotFound.selector);
        ledger.approvePayout(999);

        // Non-verifier
        vm.prank(donor1);
        vm.expectRevert(IReliefLedger.NotVerifier.selector);
        ledger.approvePayout(reqId);

        // Execute before approved reverts
        vm.expectRevert(IReliefLedger.NotApproved.selector);
        ledger.executePayout(reqId);

        // First approval
        vm.prank(v1);
        ledger.approvePayout(reqId);

        // Double vote reverts
        vm.prank(v1);
        vm.expectRevert(IReliefLedger.AlreadyVoted.selector);
        ledger.approvePayout(reqId);

        // Second approval reaches threshold (2 of 3)
        vm.prank(v2);
        vm.expectEmit(true, false, false, true);
        emit IReliefLedger.ThresholdReached(reqId, uint64(block.timestamp) + CHALLENGE);
        ledger.approvePayout(reqId);

        uint64 execAt = ledger.executableAt(reqId);
        assertEq(execAt, uint64(block.timestamp) + CHALLENGE);

        // Third verifier cannot approve once threshold reached
        vm.prank(v3);
        vm.expectRevert(IReliefLedger.AlreadyApproved.selector);
        ledger.approvePayout(reqId);

        // Execute at approvedAt + challengePeriod - 1 reverts
        vm.warp(execAt - 1);
        vm.expectRevert(IReliefLedger.ChallengeNotElapsed.selector);
        ledger.executePayout(reqId);

        // Vendor removed before execution reverts
        vm.warp(execAt);
        vm.prank(admin);
        ledger.setVendor(vendor, false);
        vm.expectRevert(IReliefLedger.VendorRemoved.selector);
        ledger.executePayout(reqId);

        // Restore vendor and pause -> execute reverts
        vm.startPrank(admin);
        ledger.setVendor(vendor, true);
        ledger.pause();
        vm.stopPrank();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        ledger.executePayout(reqId);

        // Unpause -> execute at exact execAt succeeds
        vm.prank(admin);
        ledger.unpause();
        ledger.executePayout(reqId);
        assertEq(usdc.balanceOf(vendor), 500e6);
    }

    function test_VetoDuringChallengePeriod_AndCancel_EvenWhenPaused() public {
        uint256 id = _createCampaign();
        _donateFull(id);
        _finalize(id);
        uint256 reqId = _proposePayout(id, 500e6);
        _approveN(reqId, 2); // threshold reached, in challenge period

        // Pause contract — veto and cancel MUST still work!
        vm.prank(admin);
        ledger.pause();

        // Veto by v3 during challenge period
        vm.prank(v3);
        vm.expectEmit(true, true, false, true);
        emit IReliefLedger.PayoutVetoed(reqId, v3, "ipfs://reason");
        ledger.vetoPayout(reqId, "ipfs://reason");

        assertEq(uint8(ledger.getRequest(reqId).status), uint8(IReliefLedger.RequestStatus.Vetoed));
        assertEq(ledger.getCampaign(id).openRequestId, 0);

        // Unpause, propose new, then cancel while paused
        vm.prank(admin);
        ledger.unpause();
        uint256 reqId2 = _proposePayout(id, 500e6);

        vm.prank(admin);
        ledger.pause();

        // Wrong caller cannot cancel
        vm.prank(v1);
        vm.expectRevert(IReliefLedger.NotOrganizer.selector);
        ledger.cancelPayout(reqId2);

        vm.prank(organizer);
        vm.expectEmit(true, false, false, false);
        emit IReliefLedger.PayoutCancelled(reqId2);
        ledger.cancelPayout(reqId2);
        assertEq(uint8(ledger.getRequest(reqId2).status), uint8(IReliefLedger.RequestStatus.Cancelled));
        assertEq(ledger.getCampaign(id).openRequestId, 0);
    }

    function test_SubmitDelivery_Reverts() public {
        uint256 id = _createCampaign();
        _donateFull(id);
        _finalize(id);

        // No paid in milestone yet
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.NoPaidInMilestone.selector);
        ledger.submitDelivery(id, "ipfs://del");

        // Propose open request after partial payout -> cannot submitDelivery while open request exists
        uint256 req1 = _proposePayout(id, 200e6);
        _approveN(req1, 2);
        _waitChallenge();
        ledger.executePayout(req1);

        _proposePayout(id, 100e6);
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.OpenRequestExists.selector);
        ledger.submitDelivery(id, "ipfs://del");
    }

    function test_StallRefund_AfterPartialDisbursement_CancelsOpenRequest() public {
        uint256 id = _createCampaignMultiMilestone();
        _donate(id, donor1, 750e6);
        _donate(id, donor2, 250e6); // total 1000e6
        _finalize(id);

        // Disburse 200e6 on milestone 0
        uint256 req1 = _proposePayout(id, 200e6);
        _approveN(req1, 2);
        _waitChallenge();
        ledger.executePayout(req1);

        // Propose another request that gets stalled (e.g. verifier griefing)
        uint256 req2 = _proposePayout(id, 100e6);

        uint64 lastProgress = ledger.getCampaign(id).lastProgressAt;

        // At exact lastProgress + STALL, reverts (requires strictly >)
        vm.warp(lastProgress + STALL);
        vm.expectRevert(IReliefLedger.StallNotElapsed.selector);
        ledger.triggerStallRefund(id);

        // Even while paused, triggerStallRefund succeeds at +1
        vm.prank(admin);
        ledger.pause();
        vm.warp(lastProgress + STALL + 1);
        vm.expectEmit(true, false, false, true);
        emit IReliefLedger.StallRefundTriggered(id, 800e6);
        ledger.triggerStallRefund(id);

        // Open request cancelled
        assertEq(uint8(ledger.getRequest(req2).status), uint8(IReliefLedger.RequestStatus.Cancelled));
        assertEq(ledger.getCampaign(id).openRequestId, 0);
        assertEq(ledger.getCampaign(id).refundPool, 800e6);

        // Pro-rata refunds: donor1 gets 75% of 800 = 600, donor2 gets 25% of 800 = 200
        vm.prank(donor1);
        ledger.claimRefund(id);
        vm.prank(donor2);
        ledger.claimRefund(id);

        assertEq(ledger.getCampaign(id).refundedTotal, 800e6);
    }

    function test_RoundingDust_OddAmounts() public {
        uint256 id = _createCampaign();
        // 3 equal donors contribute 333.333333 -> total 999.999999? Needs >= 1000e6
        _donate(id, donor1, 334e6);
        _donate(id, donor2, 333e6);
        _donate(id, donor3, 333e6); // total 1000e6
        _finalize(id);

        // Disburse 1e6 -> remaining 999e6, then stall
        uint256 req = _proposePayout(id, 1e6);
        _approveN(req, 2);
        _waitChallenge();
        ledger.executePayout(req);

        vm.warp(block.timestamp + STALL + 1);
        ledger.triggerStallRefund(id);

        IReliefLedger.Campaign memory c = ledger.getCampaign(id);
        assertEq(c.refundPool, 999e6);

        vm.prank(donor1);
        ledger.claimRefund(id);
        vm.prank(donor2);
        ledger.claimRefund(id);
        vm.prank(donor3);
        ledger.claimRefund(id);

        c = ledger.getCampaign(id);
        assertLe(c.refundedTotal, c.refundPool);
        // Contract still holds at least the rounding dust
        assertGe(usdc.balanceOf(address(ledger)), c.raised - c.disbursed - c.refundedTotal);
    }

    function test_NotFound_And_EdgeReverts() public {
        // View helpers before state transitions + invalid IDs
        uint256 id = _createCampaign();
        assertEq(ledger.claimableRefund(id, donor1), 0);

        vm.expectRevert(IReliefLedger.CampaignNotFound.selector);
        ledger.claimRefund(999);
        vm.expectRevert(IReliefLedger.CampaignNotFound.selector);
        ledger.triggerStallRefund(999);
        vm.expectRevert(IReliefLedger.CampaignNotFound.selector);
        ledger.proposePayout(999, vendor, 10e6, "ipfs://inv");
        vm.expectRevert(IReliefLedger.CampaignNotFound.selector);
        ledger.submitDelivery(999, "ipfs://del");

        vm.expectRevert(IReliefLedger.RequestNotFound.selector);
        ledger.executePayout(999);
        vm.expectRevert(IReliefLedger.RequestNotFound.selector);
        ledger.cancelPayout(999);
        vm.expectRevert(IReliefLedger.RequestNotFound.selector);
        ledger.approvePayout(999);
        vm.expectRevert(IReliefLedger.RequestNotFound.selector);
        ledger.vetoPayout(999, "ipfs://reason");

        // Setup active campaign with a request for remaining edge checks
        _donate(id, donor1, MIN_GOAL);
        _finalize(id);
        uint256 req = _proposePayout(id, 200e6);
        assertEq(ledger.executableAt(req), 0);

        // Veto reverts for non-verifier and invalid reason CID
        vm.prank(donor1);
        vm.expectRevert(IReliefLedger.NotVerifier.selector);
        ledger.vetoPayout(req, "ipfs://reason");

        vm.prank(v1);
        vm.expectRevert(IReliefLedger.InvalidCidLength.selector);
        ledger.vetoPayout(req, "");

        // Execute after stall -> RequestCancelled / NotActive check
        vm.warp(block.timestamp + STALL + 1);
        ledger.triggerStallRefund(id);
        vm.expectRevert(IReliefLedger.RequestNotProposed.selector);
        ledger.executePayout(req);

        // Delivery reverts for non-organizer and empty CID
        uint256 id2 = _createCampaign();
        _donate(id2, donor1, MIN_GOAL);
        _finalize(id2);
        uint256 req2 = _proposePayout(id2, 200e6);
        _approveN(req2, 2);
        _waitChallenge();
        ledger.executePayout(req2);

        vm.prank(donor1);
        vm.expectRevert(IReliefLedger.NotOrganizer.selector);
        ledger.submitDelivery(id2, "ipfs://del");

        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.InvalidCidLength.selector);
        ledger.submitDelivery(id2, "");

        // Propose on already-completed campaign & execute after stall edge
        vm.prank(organizer);
        ledger.submitDelivery(id2, "ipfs://del");
        vm.prank(organizer);
        vm.expectRevert(IReliefLedger.NotActive.selector);
        ledger.proposePayout(id2, vendor, 10e6, "ipfs://inv");
    }
}

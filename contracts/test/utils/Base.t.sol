// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReliefLedger} from "../../src/ReliefLedger.sol";
import {MockUSDC} from "../../src/mocks/MockUSDC.sol";
import {IReliefLedger} from "../../src/interfaces/IReliefLedger.sol";

/// @notice Shared test base: deploy contracts, common helpers.
abstract contract Base is Test {
    MockUSDC internal usdc;
    ReliefLedger internal ledger;

    address internal admin = makeAddr("admin");
    address internal organizer = makeAddr("organizer");
    address internal vendor = makeAddr("vendor");
    address internal donor1 = makeAddr("donor1");
    address internal donor2 = makeAddr("donor2");
    address internal donor3 = makeAddr("donor3");

    address internal v1 = makeAddr("verifier1");
    address internal v2 = makeAddr("verifier2");
    address internal v3 = makeAddr("verifier3");
    address internal v4 = makeAddr("verifier4");
    address internal v5 = makeAddr("verifier5");

    uint256 internal constant MIN_DONATION = 1e6;
    uint256 internal constant MIN_GOAL = 1000e6;
    uint64 internal constant CHALLENGE = 24 hours;
    uint64 internal constant STALL = 14 days;
    uint64 internal constant DONATION_WINDOW = 7 days;

    function setUp() public virtual {
        vm.startPrank(admin);
        usdc = new MockUSDC();
        ledger = new ReliefLedger(usdc, MIN_DONATION);
        vm.stopPrank();

        // Fund test donors using unrestricted mint
        usdc.mint(donor1, 100_000e6);
        usdc.mint(donor2, 100_000e6);
        usdc.mint(donor3, 100_000e6);

        // Register vendor
        vm.prank(admin);
        ledger.setVendor(vendor, true);
    }

    // ─── Helpers ───

    function _defaultVerifiers() internal view returns (address[] memory) {
        address[] memory v = new address[](3);
        v[0] = v1;
        v[1] = v2;
        v[2] = v3;
        return v;
    }

    function _fiveVerifiers() internal view returns (address[] memory) {
        address[] memory v = new address[](5);
        v[0] = v1;
        v[1] = v2;
        v[2] = v3;
        v[3] = v4;
        v[4] = v5;
        return v;
    }

    function _defaultMilestoneBps1() internal pure returns (uint16[] memory) {
        uint16[] memory bps = new uint16[](1);
        bps[0] = 10_000;
        return bps;
    }

    function _defaultMilestoneBps3() internal pure returns (uint16[] memory) {
        uint16[] memory bps = new uint16[](3);
        bps[0] = 3000;
        bps[1] = 3000;
        bps[2] = 4000;
        return bps;
    }

    function _defaultParams() internal view returns (IReliefLedger.CreateParams memory) {
        return IReliefLedger.CreateParams({
            organizer: organizer,
            minGoal: MIN_GOAL,
            donationDeadline: uint64(block.timestamp) + DONATION_WINDOW,
            verifiers: _defaultVerifiers(),
            threshold: 2,
            challengePeriod: CHALLENGE,
            stallTimeout: STALL,
            milestoneBps: _defaultMilestoneBps1(),
            metadataCid: "ipfs://QmFakeCid"
        });
    }

    function _createCampaign() internal returns (uint256 id) {
        vm.prank(admin);
        id = ledger.createCampaign(_defaultParams());
    }

    function _createCampaignMultiMilestone() internal returns (uint256 id) {
        IReliefLedger.CreateParams memory p = _defaultParams();
        p.milestoneBps = _defaultMilestoneBps3();
        vm.prank(admin);
        id = ledger.createCampaign(p);
    }

    function _donate(uint256 id, address donor, uint256 amount) internal {
        vm.startPrank(donor);
        usdc.approve(address(ledger), amount);
        ledger.donate(id, amount);
        vm.stopPrank();
    }

    function _donateFull(uint256 id) internal {
        _donate(id, donor1, MIN_GOAL);
    }

    function _finalize(uint256 id) internal {
        vm.warp(block.timestamp + DONATION_WINDOW + 1);
        ledger.finalizeFundraising(id);
    }

    function _proposePayout(uint256 id, uint256 amount) internal returns (uint256 reqId) {
        vm.prank(organizer);
        ledger.proposePayout(id, vendor, amount, "ipfs://QmInvoice");
        reqId = ledger.requestCount();
    }

    function _approveN(uint256 reqId, uint256 n) internal {
        address[5] memory vers = [v1, v2, v3, v4, v5];
        for (uint256 i; i < n; ++i) {
            vm.prank(vers[i]);
            ledger.approvePayout(reqId);
        }
    }

    function _waitChallenge() internal {
        vm.warp(block.timestamp + CHALLENGE);
    }

    function _fullLifecycleSingleMilestone() internal returns (uint256 id) {
        id = _createCampaign();
        _donateFull(id);
        _finalize(id);
        uint256 reqId = _proposePayout(id, MIN_GOAL);
        _approveN(reqId, 2); // threshold=2
        _waitChallenge();
        ledger.executePayout(reqId);
    }
}

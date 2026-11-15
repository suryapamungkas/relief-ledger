// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IReliefLedger} from "./interfaces/IReliefLedger.sol";

/**
 * @title ReliefLedger
 * @author Nur Hidayat Surya Pamungkas
 * @notice Transparent, on-chain disaster-relief donation escrow with milestone-based,
 *         verifier-approved disbursements. Testnet prototype — not audited.
 * @dev A single contract hosting many campaigns. Funds flow only through
 *      `executePayout` (to vendors) and `claimRefund` (to donors). No sweep,
 *      no rescue, no delegatecall, no selfdestruct, no upgradeability.
 */
contract ReliefLedger is IReliefLedger, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Immutables & constants ───
    IERC20 public immutable asset;
    uint256 public immutable minDonation;

    uint8 public constant MAX_MILESTONES = 5;
    uint8 public constant MIN_VERIFIERS = 3;
    uint8 public constant MAX_VERIFIERS = 9;
    uint64 public constant MIN_CHALLENGE = 24 hours;
    uint64 public constant MAX_CHALLENGE = 7 days;
    uint64 public constant MIN_STALL = 14 days;
    uint64 public constant MAX_STALL = 90 days;
    uint64 public constant MAX_FUNDRAISE = 90 days;
    uint256 public constant BPS = 10_000;

    // ─── Storage ───
    uint256 public campaignCount;
    uint256 public requestCount;

    mapping(uint256 => Campaign) internal _campaigns;
    mapping(uint256 => uint16[]) internal _bps;
    mapping(uint256 => uint256[]) internal _allocations;
    mapping(uint256 => address[]) internal _verifiers;
    mapping(uint256 => mapping(address => bool)) public isVerifier;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;
    mapping(uint256 => PayoutRequest) internal _requests;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => bool) public isVendor;

    // ─── Constructor ───
    constructor(IERC20 _asset, uint256 _minDonation) Ownable(msg.sender) {
        if (address(_asset) == address(0)) revert ZeroAddress();
        if (_minDonation == 0) revert InvalidAmount();
        asset = _asset;
        minDonation = _minDonation;
    }

    // ─── Admin (onlyOwner) ───

    function setVendor(address v, bool allowed) external onlyOwner {
        if (v == address(0)) revert ZeroAddress();
        if (v == address(this)) revert SelfAddress();
        isVendor[v] = allowed;
        emit VendorSet(v, allowed);
    }

    function createCampaign(CreateParams calldata p) external onlyOwner returns (uint256 id) {
        _validateCreateParams(p);

        id = ++campaignCount;
        Campaign storage c = _campaigns[id];
        c.organizer = p.organizer;
        c.status = Status.Fundraising;
        c.threshold = p.threshold;
        c.donationDeadline = p.donationDeadline;
        c.challengePeriod = p.challengePeriod;
        c.stallTimeout = p.stallTimeout;
        c.minGoal = p.minGoal;
        c.metadataCid = p.metadataCid;

        uint256 mLen = p.milestoneBps.length;
        for (uint256 i; i < mLen; ++i) {
            _bps[id].push(p.milestoneBps[i]);
        }

        uint256 vLen = p.verifiers.length;
        for (uint256 i; i < vLen; ++i) {
            _verifiers[id].push(p.verifiers[i]);
            isVerifier[id][p.verifiers[i]] = true;
        }

        emit CampaignCreated(
            id,
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
    }

    function _validateCreateParams(CreateParams calldata p) internal view {
        if (p.organizer == address(0)) revert ZeroAddress();
        if (p.minGoal == 0) revert InvalidGoal();

        if (p.donationDeadline <= uint64(block.timestamp) + 1 days) revert InvalidDeadline();
        if (p.donationDeadline > uint64(block.timestamp) + MAX_FUNDRAISE) revert InvalidDeadline();

        uint256 vLen = p.verifiers.length;
        if (vLen < MIN_VERIFIERS || vLen > MAX_VERIFIERS) revert InvalidVerifierCount();

        for (uint256 i; i < vLen; ++i) {
            if (p.verifiers[i] == address(0)) revert ZeroAddress();
            if (p.verifiers[i] == p.organizer) revert OrganizerCannotBeVerifier();
            for (uint256 j; j < i; ++j) {
                if (p.verifiers[i] == p.verifiers[j]) revert DuplicateVerifier();
            }
        }

        if (p.threshold <= vLen / 2) revert InvalidThreshold();
        if (p.threshold > vLen) revert InvalidThreshold();

        if (p.challengePeriod < MIN_CHALLENGE || p.challengePeriod > MAX_CHALLENGE) revert InvalidChallengePeriod();
        if (p.stallTimeout < MIN_STALL || p.stallTimeout > MAX_STALL) revert InvalidStallTimeout();

        uint256 mLen = p.milestoneBps.length;
        if (mLen == 0 || mLen > MAX_MILESTONES) revert InvalidMilestoneCount();
        uint256 bpsSum;
        for (uint256 i; i < mLen; ++i) {
            if (p.milestoneBps[i] == 0) revert InvalidMilestoneBps();
            bpsSum += p.milestoneBps[i];
        }
        if (bpsSum != BPS) revert MilestoneBpsSumNot10000();

        uint256 cidLen = bytes(p.metadataCid).length;
        if (cidLen == 0 || cidLen > 128) revert InvalidCidLength();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Disable renounceOwnership — §5.6 rule 10
    function renounceOwnership() public pure override {
        revert RenounceDisabled();
    }

    // ─── Donors ───

    function donate(uint256 id, uint256 amount) external nonReentrant whenNotPaused {
        if (id == 0 || id > campaignCount) revert CampaignNotFound();
        Campaign storage c = _campaigns[id];
        if (c.status != Status.Fundraising) revert NotFundraising();
        if (uint64(block.timestamp) >= c.donationDeadline) revert DeadlinePassed();
        if (amount < minDonation) revert DonationTooSmall();

        // Measure balance before/after to reject fee-on-transfer tokens
        uint256 balBefore = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = asset.balanceOf(address(this)) - balBefore;
        if (received != amount) revert FeeOnTransferNotAllowed();

        contributions[id][msg.sender] += amount;
        c.raised += amount;

        emit Donated(id, msg.sender, amount);
    }

    function claimRefund(uint256 id) external nonReentrant {
        if (id == 0 || id > campaignCount) revert CampaignNotFound();
        Campaign storage c = _campaigns[id];

        bool canRefund = c.status == Status.Refunding || (c.status == Status.Completed && c.refundPool > 0);
        if (!canRefund) revert NotRefunding();

        uint256 contrib = contributions[id][msg.sender];
        if (contrib == 0) revert NothingToRefund();
        if (refundClaimed[id][msg.sender]) revert AlreadyRefunded();

        // Floor division — dust stays in contract (§5.6 rule 9)
        uint256 refundAmount = (contrib * c.refundPool) / c.raised;

        // Effects before interaction
        refundClaimed[id][msg.sender] = true;
        c.refundedTotal += refundAmount;

        asset.safeTransfer(msg.sender, refundAmount);

        emit Refunded(id, msg.sender, refundAmount);
    }

    // ─── Permissionless ───

    function finalizeFundraising(uint256 id) external {
        if (id == 0 || id > campaignCount) revert CampaignNotFound();
        Campaign storage c = _campaigns[id];
        if (c.status != Status.Fundraising) revert NotFundraising();
        if (uint64(block.timestamp) < c.donationDeadline) revert DeadlineNotPassed();

        if (c.raised >= c.minGoal) {
            // Compute allocations
            uint16[] storage bps_ = _bps[id];
            uint256 mLen = bps_.length;
            uint256 sumOthers;

            for (uint256 i; i < mLen - 1; ++i) {
                uint256 alloc = (c.raised * bps_[i]) / BPS;
                _allocations[id].push(alloc);
                sumOthers += alloc;
            }
            // Last milestone gets the remainder so the sum equals raised exactly
            _allocations[id].push(c.raised - sumOthers);

            c.currentAvailable = _allocations[id][0];
            c.lastProgressAt = uint64(block.timestamp);
            c.status = Status.Active;

            emit FundraisingFinalized(id, true, c.raised, _allocations[id]);
        } else {
            c.refundPool = c.raised;
            c.status = Status.Refunding;

            uint256[] memory empty = new uint256[](0);
            emit FundraisingFinalized(id, false, c.raised, empty);
        }
    }

    function executePayout(uint256 requestId) external nonReentrant whenNotPaused {
        if (requestId == 0 || requestId > requestCount) revert RequestNotFound();
        PayoutRequest storage r = _requests[requestId];
        if (r.status != RequestStatus.Proposed) revert RequestNotProposed();
        if (r.approvedAt == 0) revert NotApproved();
        Campaign storage c = _campaigns[r.campaignId];
        if (c.status != Status.Active) revert NotActive();
        if (uint64(block.timestamp) < r.approvedAt + c.challengePeriod) revert ChallengeNotElapsed();
        if (!isVendor[r.vendor]) revert VendorRemoved();
        if (r.amount > c.currentAvailable) revert AmountExceedsAvailable();

        // Effects first
        r.status = RequestStatus.Executed;
        c.disbursed += r.amount;
        c.currentAvailable -= r.amount;
        c.paidInCurrentMilestone += r.amount;
        c.openRequestId = 0;
        c.lastProgressAt = uint64(block.timestamp);

        // Interaction
        asset.safeTransfer(r.vendor, r.amount);

        emit PayoutExecuted(r.campaignId, requestId, r.vendor, r.amount);
    }

    function triggerStallRefund(uint256 id) external {
        if (id == 0 || id > campaignCount) revert CampaignNotFound();
        Campaign storage c = _campaigns[id];
        if (c.status != Status.Active) revert NotActive();
        if (uint64(block.timestamp) <= c.lastProgressAt + c.stallTimeout) revert StallNotElapsed();

        // Cancel any open request
        if (c.openRequestId != 0) {
            _requests[c.openRequestId].status = RequestStatus.Cancelled;
            emit PayoutCancelled(c.openRequestId);
            c.openRequestId = 0;
        }

        c.refundPool = c.raised - c.disbursed;
        c.status = Status.Refunding;

        emit StallRefundTriggered(id, c.refundPool);
    }

    // ─── Organizer ───

    function proposePayout(
        uint256 id,
        address vendor,
        uint256 amount,
        string calldata invoiceCid
    )
        external
        whenNotPaused
    {
        if (id == 0 || id > campaignCount) revert CampaignNotFound();
        Campaign storage c = _campaigns[id];
        if (c.status != Status.Active) revert NotActive();
        if (msg.sender != c.organizer) revert NotOrganizer();
        if (c.openRequestId != 0) revert OpenRequestExists();
        if (!isVendor[vendor]) revert VendorNotRegistered();
        if (vendor == c.organizer) revert VendorIsOrganizer();
        if (isVerifier[id][vendor]) revert VendorIsVerifier();
        if (amount == 0 || amount > c.currentAvailable) revert AmountExceedsAvailable();

        uint256 cidLen = bytes(invoiceCid).length;
        if (cidLen == 0 || cidLen > 128) revert InvalidCidLength();

        uint256 reqId = ++requestCount;
        PayoutRequest storage r = _requests[reqId];
        r.campaignId = id;
        r.milestone = c.currentMilestone;
        r.vendor = vendor;
        r.amount = amount;
        r.invoiceHash = keccak256(bytes(invoiceCid));
        r.status = RequestStatus.Proposed;

        c.openRequestId = reqId;

        emit PayoutProposed(id, reqId, c.currentMilestone, vendor, amount, invoiceCid);
    }

    function cancelPayout(uint256 requestId) external {
        if (requestId == 0 || requestId > requestCount) revert RequestNotFound();
        PayoutRequest storage r = _requests[requestId];
        if (r.status != RequestStatus.Proposed) revert RequestNotProposed();
        Campaign storage c = _campaigns[r.campaignId];
        if (msg.sender != c.organizer) revert NotOrganizer();

        r.status = RequestStatus.Cancelled;
        c.openRequestId = 0;

        emit PayoutCancelled(requestId);
    }

    function submitDelivery(uint256 id, string calldata deliveryCid) external {
        if (id == 0 || id > campaignCount) revert CampaignNotFound();
        Campaign storage c = _campaigns[id];
        if (c.status != Status.Active) revert NotActive();
        if (msg.sender != c.organizer) revert NotOrganizer();
        if (c.paidInCurrentMilestone == 0) revert NoPaidInMilestone();
        if (c.openRequestId != 0) revert OpenRequestExists();

        uint256 cidLen = bytes(deliveryCid).length;
        if (cidLen == 0 || cidLen > 128) revert InvalidCidLength();

        c.lastProgressAt = uint64(block.timestamp);

        uint256 totalMilestones = _bps[id].length;
        bool isLastMilestone = uint256(c.currentMilestone) + 1 == totalMilestones;

        if (isLastMilestone) {
            c.status = Status.Completed;
            c.refundPool = c.currentAvailable; // unspent leftover
            c.currentAvailable = 0;
            emit DeliverySubmitted(id, c.currentMilestone, deliveryCid);
            emit CampaignCompleted(id, c.refundPool);
        } else {
            emit DeliverySubmitted(id, c.currentMilestone, deliveryCid);
            c.currentMilestone++;
            c.currentAvailable += _allocations[id][c.currentMilestone];
            c.paidInCurrentMilestone = 0;
        }
    }

    // ─── Verifiers ───

    function approvePayout(uint256 requestId) external whenNotPaused {
        if (requestId == 0 || requestId > requestCount) revert RequestNotFound();
        PayoutRequest storage r = _requests[requestId];
        if (r.status != RequestStatus.Proposed) revert RequestNotProposed();
        if (!isVerifier[r.campaignId][msg.sender]) revert NotVerifier();
        if (hasVoted[requestId][msg.sender]) revert AlreadyVoted();
        if (r.approvedAt != 0) revert AlreadyApproved();

        hasVoted[requestId][msg.sender] = true;
        r.approvals++;

        emit PayoutApproved(requestId, msg.sender, r.approvals);

        Campaign storage c = _campaigns[r.campaignId];
        if (r.approvals == c.threshold) {
            r.approvedAt = uint64(block.timestamp);
            uint64 execAt = r.approvedAt + c.challengePeriod;
            emit ThresholdReached(requestId, execAt);
        }
    }

    function vetoPayout(uint256 requestId, string calldata reasonCid) external {
        if (requestId == 0 || requestId > requestCount) revert RequestNotFound();
        PayoutRequest storage r = _requests[requestId];
        if (r.status != RequestStatus.Proposed) revert RequestNotProposed();
        if (!isVerifier[r.campaignId][msg.sender]) revert NotVerifier();

        uint256 cidLen = bytes(reasonCid).length;
        if (cidLen == 0 || cidLen > 128) revert InvalidCidLength();

        r.status = RequestStatus.Vetoed;
        Campaign storage c = _campaigns[r.campaignId];
        c.openRequestId = 0;

        emit PayoutVetoed(requestId, msg.sender, reasonCid);
    }

    // ─── Views ───

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        return _campaigns[id];
    }

    function getRequest(uint256 requestId) external view returns (PayoutRequest memory) {
        return _requests[requestId];
    }

    function getVerifiers(uint256 id) external view returns (address[] memory) {
        return _verifiers[id];
    }

    function getAllocations(uint256 id) external view returns (uint256[] memory) {
        return _allocations[id];
    }

    function getBps(uint256 id) external view returns (uint16[] memory) {
        return _bps[id];
    }

    function claimableRefund(uint256 id, address donor) external view returns (uint256) {
        Campaign storage c = _campaigns[id];
        bool canRefund = c.status == Status.Refunding || (c.status == Status.Completed && c.refundPool > 0);
        if (!canRefund) return 0;
        if (contributions[id][donor] == 0) return 0;
        if (refundClaimed[id][donor]) return 0;
        return (contributions[id][donor] * c.refundPool) / c.raised;
    }

    function executableAt(uint256 requestId) external view returns (uint64) {
        PayoutRequest storage r = _requests[requestId];
        if (r.approvedAt == 0) return 0;
        Campaign storage c = _campaigns[r.campaignId];
        return r.approvedAt + c.challengePeriod;
    }
}

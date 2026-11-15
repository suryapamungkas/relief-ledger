// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IReliefLedger {
    // ─── Enums ───
    enum Status {
        Fundraising,
        Active,
        Completed,
        Refunding
    }

    enum RequestStatus {
        None,
        Proposed,
        Vetoed,
        Cancelled,
        Executed
    }

    // ─── Structs ───
    struct Campaign {
        address organizer;
        Status status;
        uint8 currentMilestone;
        uint8 threshold;
        uint64 donationDeadline;
        uint64 challengePeriod;
        uint64 stallTimeout;
        uint64 lastProgressAt;
        uint256 minGoal;
        uint256 raised;
        uint256 disbursed;
        uint256 currentAvailable;
        uint256 paidInCurrentMilestone;
        uint256 refundPool;
        uint256 refundedTotal;
        uint256 openRequestId;
        string metadataCid;
    }

    struct PayoutRequest {
        uint256 campaignId;
        uint8 milestone;
        address vendor;
        uint256 amount;
        bytes32 invoiceHash;
        uint64 approvedAt;
        uint8 approvals;
        RequestStatus status;
    }

    struct CreateParams {
        address organizer;
        uint256 minGoal;
        uint64 donationDeadline;
        address[] verifiers;
        uint8 threshold;
        uint64 challengePeriod;
        uint64 stallTimeout;
        uint16[] milestoneBps;
        string metadataCid;
    }

    // ─── Events ───
    event VendorSet(address indexed vendor, bool allowed);
    event CampaignCreated(
        uint256 indexed id,
        address indexed organizer,
        address[] verifiers,
        uint8 threshold,
        uint256 minGoal,
        uint64 donationDeadline,
        uint64 challengePeriod,
        uint64 stallTimeout,
        uint16[] milestoneBps,
        string metadataCid
    );
    event Donated(uint256 indexed id, address indexed donor, uint256 amount);
    event FundraisingFinalized(uint256 indexed id, bool success, uint256 raised, uint256[] allocations);
    event PayoutProposed(
        uint256 indexed id,
        uint256 indexed requestId,
        uint8 milestone,
        address indexed vendor,
        uint256 amount,
        string invoiceCid
    );
    event PayoutApproved(uint256 indexed requestId, address indexed verifier, uint8 approvals);
    event ThresholdReached(uint256 indexed requestId, uint64 executableAt);
    event PayoutVetoed(uint256 indexed requestId, address indexed verifier, string reasonCid);
    event PayoutCancelled(uint256 indexed requestId);
    event PayoutExecuted(uint256 indexed id, uint256 indexed requestId, address indexed vendor, uint256 amount);
    event DeliverySubmitted(uint256 indexed id, uint8 milestone, string deliveryCid);
    event CampaignCompleted(uint256 indexed id, uint256 refundPool);
    event StallRefundTriggered(uint256 indexed id, uint256 refundPool);
    event Refunded(uint256 indexed id, address indexed donor, uint256 amount);

    // ─── Errors ───
    error ZeroAddress();
    error InvalidAmount();
    error InvalidCidLength();
    error InvalidGoal();
    error InvalidDeadline();
    error InvalidVerifierCount();
    error DuplicateVerifier();
    error OrganizerCannotBeVerifier();
    error InvalidThreshold();
    error InvalidChallengePeriod();
    error InvalidStallTimeout();
    error InvalidMilestoneCount();
    error InvalidMilestoneBps();
    error MilestoneBpsSumNot10000();
    error NotFundraising();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error DonationTooSmall();
    error FeeOnTransferNotAllowed();
    error NotActive();
    error NotOrganizer();
    error OpenRequestExists();
    error VendorNotRegistered();
    error VendorIsOrganizer();
    error VendorIsVerifier();
    error AmountExceedsAvailable();
    error NotVerifier();
    error AlreadyVoted();
    error AlreadyApproved();
    error RequestNotProposed();
    error ChallengeNotElapsed();
    error VendorRemoved();
    error StallNotElapsed();
    error NotRefunding();
    error NothingToRefund();
    error AlreadyRefunded();
    error NoPaidInMilestone();
    error RenounceDisabled();
    error SelfAddress();
    error CampaignNotFound();
    error RequestNotFound();
    error NotApproved();

    // ─── Views ───
    function getCampaign(uint256 id) external view returns (Campaign memory);
    function getRequest(uint256 requestId) external view returns (PayoutRequest memory);
    function getVerifiers(uint256 id) external view returns (address[] memory);
    function getAllocations(uint256 id) external view returns (uint256[] memory);
    function getBps(uint256 id) external view returns (uint16[] memory);
    function claimableRefund(uint256 id, address donor) external view returns (uint256);
    function executableAt(uint256 requestId) external view returns (uint64);
}

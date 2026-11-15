# ReliefLedger — Architecture

> **Version:** 1.0 · Testnet Prototype (Sepolia)

## Table of Contents

- [System Overview](#system-overview)
- [Component Diagram](#component-diagram)
- [Data Model](#data-model)
- [State Machine](#state-machine)
- [Sequence Diagrams](#sequence-diagrams)
- [Gas Considerations](#gas-considerations)
- [Design Decisions](#design-decisions)

---

## System Overview

ReliefLedger is a milestone-based disaster-relief escrow built on Ethereum (Sepolia testnet). A single non-upgradeable smart contract (`ReliefLedger.sol`) manages many independent campaigns. Funds flow **only** through two code-enforced paths — payout to a registered vendor after verifier approval, or pro-rata refund to donors — guaranteeing that no party, including the contract owner, can extract escrowed funds.

The stack is intentionally simple:

| Layer | Technology | Role |
|---|---|---|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin v5 | Source of truth; escrow, state machine, access control |
| Mock Stablecoin | `MockUSDC` (ERC-20, 6 decimals) | Testnet-only donation token |
| Indexer | Custom TypeScript (`viem` + Express + SQLite) | Event-driven read model with reorg check & REST API |
| Frontend | Vite + React + TypeScript, wagmi v2, RainbowKit, Motion | User interface |
| Evidence Storage | IPFS via Pinata (server-side upload) | Invoice and delivery proof storage |
| Hosting | Vercel | Frontend + serverless upload function |

---

## Component Diagram

```mermaid
graph TB
    subgraph "On-Chain (Sepolia)"
        RL["ReliefLedger.sol<br/>(single contract, multi-campaign)"]
        MUSDC["MockUSDC.sol<br/>(ERC-20 mock, 6 decimals)"]
        RL -- "safeTransferFrom / safeTransfer" --> MUSDC
    end

    subgraph "Off-Chain Infrastructure"
        IDX["viem Event Indexer<br/>(polling + SQLite + Express API)"]
        IPFS["IPFS / Pinata<br/>(evidence storage)"]
        UPLOAD["Vercel Serverless<br/>(api/upload.ts)"]
    end

    subgraph "Frontend (Vite + React)"
        UI["React App"]
        WAGMI["wagmi v2 + viem"]
        RK["RainbowKit"]
        MOTION["Motion (animations)"]
    end

    subgraph "Users"
        ADMIN["Admin (owner)"]
        ORG["Organizer"]
        VER["Verifiers (3-9)"]
        DONOR["Donors"]
        VENDOR["Vendors"]
    end

    ADMIN -- "createCampaign, setVendor,<br/>pause/unpause" --> UI
    ORG -- "proposePayout, cancelPayout,<br/>submitDelivery" --> UI
    VER -- "approvePayout, vetoPayout" --> UI
    DONOR -- "donate, claimRefund" --> UI
    VENDOR -- "receives payouts" --> RL

    UI --> WAGMI
    WAGMI -- "contract calls" --> RL
    UI -- "upload evidence" --> UPLOAD
    UPLOAD -- "pin file" --> IPFS
    UI -- "read data" --> IDX
    IDX -- "watch events" --> RL

    style RL fill:#0d9488,stroke:#064e3b,color:#fff
    style MUSDC fill:#10b981,stroke:#064e3b,color:#fff
```

---

## Data Model

### Core Structures

```mermaid
erDiagram
    CAMPAIGN {
        uint256 id PK
        address organizer
        Status status
        uint8 currentMilestone
        uint8 threshold
        uint64 donationDeadline
        uint64 challengePeriod
        uint64 stallTimeout
        uint64 lastProgressAt
        uint256 minGoal
        uint256 raised
        uint256 disbursed
        uint256 currentAvailable
        uint256 paidInCurrentMilestone
        uint256 refundPool
        uint256 refundedTotal
        uint256 openRequestId
        string metadataCid
    }

    PAYOUT_REQUEST {
        uint256 requestId PK
        uint256 campaignId FK
        uint8 milestone
        address vendor
        uint256 amount
        bytes32 invoiceHash
        uint64 approvedAt
        uint8 approvals
        RequestStatus status
    }

    CAMPAIGN ||--o{ PAYOUT_REQUEST : "has"
    CAMPAIGN ||--|{ VERIFIER : "has 3-9"
    CAMPAIGN ||--o{ DONATION : "receives"
    CAMPAIGN ||--|{ MILESTONE_BPS : "defines"
    CAMPAIGN ||--|{ ALLOCATION : "computed at finalize"

    VERIFIER {
        uint256 campaignId FK
        address verifierAddr
    }

    DONATION {
        uint256 campaignId FK
        address donor
        uint256 amount
    }

    MILESTONE_BPS {
        uint256 campaignId FK
        uint8 index
        uint16 bps
    }

    ALLOCATION {
        uint256 campaignId FK
        uint8 index
        uint256 amount
    }
```

### Storage Mappings

| Mapping | Key(s) | Value | Purpose |
|---|---|---|---|
| `campaigns` | `id` | `Campaign` struct | Campaign state |
| `bps` | `id` | `uint16[]` | Milestone percentage allocations (basis points) |
| `allocations` | `id` | `uint256[]` | Actual token amounts per milestone (computed at finalize) |
| `verifiers` | `id` | `address[]` | Verifier list per campaign |
| `isVerifier` | `id`, `addr` | `bool` | Fast verifier lookup |
| `contributions` | `id`, `addr` | `uint256` | Per-donor contribution tracking |
| `refundClaimed` | `id`, `addr` | `bool` | Prevents double refund claims |
| `requests` | `requestId` | `PayoutRequest` | Payout request state |
| `hasVoted` | `requestId`, `addr` | `bool` | Prevents double voting |
| `isVendor` | `addr` | `bool` | Global vendor registry |

### Enums

| Enum | Values | Notes |
|---|---|---|
| `Status` | `Fundraising → Active → Completed / Refunding` | Monotonic; terminal states never change |
| `RequestStatus` | `None, Proposed, Vetoed, Cancelled, Executed` | Per payout request |

---

## State Machine

```mermaid
stateDiagram-v2
    [*] --> Fundraising : createCampaign()

    Fundraising --> Active : finalizeFundraising()<br/>raised >= minGoal
    Fundraising --> Refunding : finalizeFundraising()<br/>raised < minGoal

    Active --> Completed : submitDelivery()<br/>final milestone
    Active --> Refunding : triggerStallRefund()<br/>stall timeout elapsed

    Completed --> [*] : refundPool == 0
    Completed --> CompletedRefund : refundPool > 0

    state CompletedRefund {
        [*] --> ClaimingRefunds
        ClaimingRefunds : donors call claimRefund()
    }

    state Refunding {
        [*] --> RefundOpen
        RefundOpen : donors call claimRefund()
        RefundOpen : pro-rata of remaining funds
    }

    note right of Fundraising
        Donors call donate()
        Anyone can call finalizeFundraising()
        after donationDeadline passes
    end note

    note right of Active
        Organizer proposes payouts
        Verifiers approve/veto
        Anyone executes after challenge period
        Organizer submits delivery proof
    end note
```

### Transition Rules

| From | To | Trigger | Condition |
|---|---|---|---|
| `Fundraising` | `Active` | `finalizeFundraising()` | `block.timestamp >= donationDeadline` AND `raised >= minGoal` |
| `Fundraising` | `Refunding` | `finalizeFundraising()` | `block.timestamp >= donationDeadline` AND `raised < minGoal` |
| `Active` | `Refunding` | `triggerStallRefund()` | `block.timestamp > lastProgressAt + stallTimeout` |
| `Active` | `Completed` | `submitDelivery()` | Final milestone delivery proof submitted |

> **Key invariant:** Status transitions are **monotonic** — no state ever moves backwards. `Completed` and `Refunding` are terminal.

---

## Sequence Diagrams

### Donation Flow

```mermaid
sequenceDiagram
    actor Donor
    participant UI as Frontend
    participant RL as ReliefLedger
    participant USDC as MockUSDC

    Donor->>UI: Enter donation amount
    UI->>USDC: Check allowance
    alt Allowance insufficient
        UI->>Donor: Prompt approve tx
        Donor->>USDC: approve(reliefLedger, amount)
        USDC-->>Donor: Approval confirmed
    end
    Donor->>UI: Click Donate
    UI->>RL: donate(campaignId, amount)
    RL->>USDC: balanceOf(this) [before]
    RL->>USDC: safeTransferFrom(donor, this, amount)
    RL->>USDC: balanceOf(this) [after]
    RL->>RL: Verify received == amount<br/>(reject fee-on-transfer)
    RL->>RL: contributions[id][donor] += amount<br/>raised += amount
    RL-->>UI: Donated event
    UI-->>Donor: Confirmation + updated progress
```

### Payout Lifecycle

```mermaid
sequenceDiagram
    actor Org as Organizer
    actor V1 as Verifier 1
    actor V2 as Verifier 2
    actor V3 as Verifier 3
    actor Anyone
    participant RL as ReliefLedger
    participant USDC as MockUSDC
    participant Vendor

    Note over RL: Campaign is Active, milestone 0 unlocked

    Org->>RL: proposePayout(id, vendor, amount, invoiceCid)
    RL-->>RL: Validate: Active, no open request,<br/>vendor registered, amount <= available
    RL-->>Org: PayoutProposed event

    V1->>RL: approvePayout(requestId)
    RL-->>V1: PayoutApproved (1 of 3)

    V2->>RL: approvePayout(requestId)
    RL-->>V2: PayoutApproved (2 of 3)

    V3->>RL: approvePayout(requestId)
    RL-->>V3: PayoutApproved (3 of 3)<br/>ThresholdReached (executableAt)

    Note over RL: Challenge period begins (24h - 7d)
    Note over RL: Any verifier can vetoPayout() during this window

    Anyone->>RL: executePayout(requestId)
    RL->>RL: Verify: approved, challenge elapsed,<br/>vendor still registered
    RL->>RL: Effects: disbursed += amount,<br/>currentAvailable -= amount,<br/>openRequestId = 0
    RL->>USDC: safeTransfer(vendor, amount)
    USDC-->>Vendor: Tokens received
    RL-->>Anyone: PayoutExecuted event

    Org->>RL: submitDelivery(id, deliveryCid)
    RL-->>RL: Advance milestone or complete campaign
    RL-->>Org: DeliverySubmitted event
```

### Stall Refund

```mermaid
sequenceDiagram
    actor Anyone
    actor Donor1
    actor Donor2
    participant RL as ReliefLedger
    participant USDC as MockUSDC

    Note over RL: Campaign Active<br/>No progress for > stallTimeout

    Anyone->>RL: triggerStallRefund(campaignId)
    RL->>RL: Verify: Active, stall timeout elapsed
    RL->>RL: Cancel any open request
    RL->>RL: refundPool = raised - disbursed
    RL->>RL: Status → Refunding
    RL-->>Anyone: StallRefundTriggered event

    Donor1->>RL: claimRefund(campaignId)
    RL->>RL: amount = contributions[id][donor1]<br/>× refundPool / raised
    RL->>RL: refundClaimed = true<br/>refundedTotal += amount
    RL->>USDC: safeTransfer(donor1, amount)
    RL-->>Donor1: Refunded event

    Donor2->>RL: claimRefund(campaignId)
    RL->>RL: Pro-rata calculation
    RL->>USDC: safeTransfer(donor2, amount)
    RL-->>Donor2: Refunded event

    Note over RL: Rounding dust stays in contract<br/>(Σ refunds ≤ refundPool always holds)
```

### Veto Flow

```mermaid
sequenceDiagram
    actor Org as Organizer
    actor V1 as Verifier 1
    actor V2 as Verifier 2
    participant RL as ReliefLedger

    Org->>RL: proposePayout(id, vendor, amount, cid)
    RL-->>Org: PayoutProposed

    V1->>RL: approvePayout(requestId)
    RL-->>V1: PayoutApproved (1 of 3)

    Note over RL: V2 identifies fraudulent invoice

    V2->>RL: vetoPayout(requestId, reasonCid)
    RL->>RL: Status → Vetoed<br/>openRequestId = 0
    RL-->>V2: PayoutVetoed

    Note over RL: Single veto kills the request<br/>Organizer must propose a new one
```

---

## Gas Considerations

### Design Choices for Gas Efficiency

| Decision | Gas Impact | Rationale |
|---|---|---|
| Single contract (no proxies) | Lower per-call overhead | No delegatecall cost; simpler storage layout |
| Store CID hashes, emit full CIDs | ~20k gas saved per write vs storing strings | Events are cheaper than storage; full CIDs available in logs |
| Bounded arrays (max 9 verifiers, max 5 milestones) | Predictable loop gas | Prevents unbounded iteration; worst case is known |
| Pull-based refunds | O(1) per claim | Never loops over donors; each donor pays their own gas |
| Single `openRequestId` per campaign | No array scanning | Only one payout request active at a time |
| `uint64` for timestamps | 8 bytes vs 32 | Adequate for timestamps; tighter struct packing |

### Measured Gas Snapshots (`forge snapshot`)

Full gas numbers are tracked in [`.gas-snapshot`](../contracts/.gas-snapshot), generated via `forge snapshot`. Representative test-suite measurements (including setup + assertions per test case):

| Test Suite Scenario | Measured Gas |
|---|---|
| `test_CreateCampaign_Happy` | 508,433 |
| `test_Donate_HappyAndReverts` | 574,523 |
| `test_Approve_Challenge_Execute_Boundaries` | 865,219 |
| `test_VetoDuringChallengePeriod_AndCancel_EvenWhenPaused` | 932,125 |
| `test_FullLifecycle_MultiMilestone_WithLeftoverRefund` | 1,435,999 |
| `test_GoalNotMet_FullRefund_EvenWhenPaused` | 646,710 |
| `test_StallRefund_AfterPartialDisbursement_CancelsOpenRequest` | 1,181,147 |
| `test_SetVendor_HappyAndEvents` | 35,915 |
| `test_PauseUnpause_AccessControl` | 37,495 |

---

## Design Decisions

### Why No Upgradeability

The contract is intentionally non-upgradeable:

- **Trust:** Donors need assurance that the escrow rules cannot be changed after they deposit funds. An upgradeable proxy means a proxy admin could rewrite the contract to drain the escrow.
- **Simplicity:** Proxy patterns (UUPS, Transparent) add attack surface — storage collisions, initializer bugs, unprotected `upgradeTo` calls — without proportionate benefit for a testnet prototype.
- **Immutable guarantees:** Campaign parameters are fixed at creation. Combined with a non-upgradeable contract, this means the rules under which a donor contributed can never change.

> **Trade-off:** Bug fixes require deploying a new contract and migrating campaigns. Acceptable for a testnet prototype; a production system might use a timelock-guarded proxy with explicit donor consent for migrations.

### Why Single-Veto Power

Any single verifier can veto a payout request, killing it immediately:

- **Conservative by design:** In disaster relief, false positives (blocking a legitimate payout) are recoverable — the organizer re-submits with better evidence. False negatives (allowing a fraudulent payout) are irrecoverable — funds are gone.
- **Stall protection:** A malicious verifier who abuses veto power is bounded by the stall timeout. After `stallTimeout` with no progress, anyone can trigger `triggerStallRefund()` and donors get their remaining funds back.
- **Simplicity:** Multi-veto thresholds add complexity (who can override? what if veto count < threshold?) without clear benefit when stall refund already caps downside.

> **Trade-off:** A single griefing verifier can delay payouts by up to `stallTimeout`. This is documented in the Threat Model (Threat #5).

### Why Fixed Fundraising Window

Donations are only accepted during a fixed window (`donationDeadline`):

- **Predictable accounting:** The allocation split is computed once at `finalizeFundraising()`. Allowing donations after finalization would require re-computing all milestone allocations.
- **Clear lifecycle:** Donors know exactly when fundraising ends. The campaign either meets its goal or fails cleanly.
- **Prevents manipulation:** Without a fixed window, late donations could be used to dilute earlier donors' refund shares or change milestone allocations mid-campaign.

> **Trade-off:** Legitimate late donors cannot contribute. This is listed as an out-of-scope roadmap item.

### Why `Ownable2Step` (Not Direct Ownership Transfer)

Two-step ownership transfer prevents accidental loss of admin control:

1. Current owner calls `transferOwnership(newOwner)` — sets pending owner.
2. New owner calls `acceptOwnership()` — confirms the transfer.

If the wrong address is specified in step 1, no harm is done because step 2 will never succeed. Combined with `renounceOwnership` reverting, the contract always has an admin who can create campaigns and manage vendors.

### Why `lastProgressAt` Updates Are Restricted

Only three functions update `lastProgressAt`: `finalizeFundraising`, `executePayout`, and `submitDelivery`. This bounds how long an organizer can delay the stall timeout:

- An organizer cannot reset the stall clock by simply proposing payouts or submitting empty deliveries.
- Maximum delay is bounded: at most `2 × number_of_milestones` progress resets before funds are fully disbursed or the campaign completes.
- This ensures the stall refund mechanism remains a credible threat to negligent organizers.

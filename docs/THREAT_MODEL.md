# ReliefLedger — Threat Model

> **Version:** 1.0 · Testnet Prototype (Sepolia)
> **Scope:** Smart contract (`ReliefLedger.sol`), frontend, indexer, and evidence pipeline.
> **Not in scope:** Legal/regulatory risk, fiat off-ramp, real-world identity verification.

---

## Summary

ReliefLedger is a **testnet prototype** for transparent disaster-relief disbursements. The threat model covers all 13 identified threat categories from the system specification. The core design philosophy is: **trust the chain, not the people**. Where human judgment is unavoidable (verifiers, admin), the system bounds the damage that any single bad actor can cause.

---

## Threat Model Table

| # | Threat | Mitigation in Design | Residual Risk |
|---|---|---|---|
| 1 | Fake organization | Admin-only campaign creation; funds never reach organizer directly | Admin vetting is off-chain |
| 2 | Fake invoice / delivery evidence | Multi-verifier approval, challenge period, vendor registry, hash-anchored evidence | Verifiers can be deceived by well-constructed forgeries |
| 3 | Verifier collusion | Strict-majority threshold, distinct verifiers, organizer excluded, stall refund | Majority collusion succeeds; threshold does not stop it, only raises the bar |
| 4 | Organizer self-dealing | Organizer cannot be verifier or vendor; payout only to registered vendors | Off-chain relationships between organizer and vendor are undetectable on-chain |
| 5 | Verifier griefing (endless veto) | Stall timeout lets donors refund remaining funds | Delay up to `stallTimeout` (14–90 days) |
| 6 | Reentrancy | CEI pattern + `nonReentrant` + pull refunds (never loops over donors) | None known; residual risk from future dependency changes |
| 7 | Admin rug | No withdrawal path, no upgrade, params immutable after creation, 2-step ownership, pause cannot block refunds | Admin can censor new donations and payouts via `pause()` |
| 8 | Fee-on-transfer / malicious token | Single immutable stablecoin asset; balance-delta check in `donate()` rejects discrepancies | Token issuer risk (MockUSDC issuer controls minting) |
| 9 | Rounding / dust exploits | Floor division, exact final-allocation remainder assigned to last milestone, fuzz and invariant tests verify `Σ refunds ≤ refundPool` | Rounding dust stays in contract permanently (by design) |
| 10 | Donation dilution / front-running | Fixed fundraising window; no price/share mechanics; allocation computed once at finalization | None material; late-donor front-running is bounded by the deadline |
| 11 | Evidence spam / log bloat | CID length bounded at 128 bytes; hashes stored on-chain, full CIDs in events only | Minor gas cost from maximal-length CID strings |
| 12 | Indexer or frontend compromise | Contract is source of truth; refunds and direct contract reads always work without the indexer | UI phishing; malicious indexer serving false data |
| 13 | Illicit-funds donations | Out of scope on testnet | Production deployment needs compliance review and may require on-chain KYC |

---

## Detailed Analysis by Category

### Threat 1 — Fake Organization

**Attack vector:** An attacker registers as a legitimate disaster-relief organization, creates a campaign, and siphons funds through approving verifiers.

**Mitigations:**
- Campaign creation is restricted to the admin (`Ownable2Step` owner). The admin must vet the organizer's identity and legitimacy off-chain before calling `createCampaign()`.
- Even with a campaign created, funds **never** flow to the organizer directly. The organizer can only propose payouts to registered vendors. The organizer cannot be in the vendor registry.
- All campaign parameters (organizer, verifiers, milestones) are **immutable** after creation. No bait-and-switch after donors commit.

**Residual risk:** The vetting process is off-chain. The admin must have robust KYC/AML procedures. On testnet, this is not enforced. Production deployment would require admin to be a multisig with documented vetting procedures.

---

### Threat 2 — Fake Invoice / Delivery Evidence

**Attack vector:** An organizer submits a fabricated invoice CID. Verifiers approve based on false evidence. Funds flow to a complicit vendor.

**Mitigations:**
- Each payout requires a strict-majority threshold of independent verifiers to approve (e.g., 3-of-5).
- The invoice CID is hashed on-chain (`invoiceHash = keccak256(cid)`), anchoring the evidence immutably. Anyone can verify that the IPFS content matches the hash.
- The challenge period (24 hours to 7 days) gives other verifiers time to discover and veto a fraudulent request even after threshold approval.
- Only registered vendors can receive payouts, reducing the attack surface.
- Delivery proof CIDs are publicly viewable on IPFS; anyone can audit.

**Residual risk:** Verifiers who do not independently verify evidence (or who are colluding) cannot be stopped by contract logic. This is a human governance problem. The contract only enforces *process* (threshold + challenge period), not *correctness* of the evidence.

---

### Threat 3 — Verifier Collusion

**Attack vector:** A majority of verifiers, possibly in coordination with the organizer, approve a fraudulent payout and no veto is filed during the challenge period.

**Mitigations:**
- Threshold is set to `> verifiers.length / 2` — a strict majority is required. With 5 verifiers and threshold 3, any 3 colluding verifiers plus 1 non-vetoing verifier can approve a payout.
- Verifiers must be distinct addresses; duplicates are rejected at campaign creation.
- The organizer cannot be a verifier, ensuring the organizer cannot vote on their own proposals.
- Verifiers are set at campaign creation and are immutable — no post-creation manipulation.

**Residual risk:** Majority collusion succeeds by design — the system cannot prevent colluding honest-looking verifiers from approving a fake invoice. The assumption is that verifiers are independent and have reputational incentives to behave honestly. This is documented clearly in `TRUST_ASSUMPTIONS.md`.

---

### Threat 4 — Organizer Self-Dealing

**Attack vector:** The organizer routes funds to themselves or a shell vendor they control.

**Mitigations:**
- The organizer address is explicitly prohibited from being in the vendor registry (checked in `proposePayout`).
- The organizer cannot be a verifier for their own campaign (checked at campaign creation).
- All vendor payments require multi-verifier approval and a challenge period — multiple independent parties must sign off.
- The vendor registry is admin-controlled; vendors must be pre-approved.

**Residual risk:** The organizer could have an undisclosed off-chain relationship with a registered vendor. This cannot be detected on-chain. Mitigation relies on verifier diligence and public transparency of the fund-flow ledger.

---

### Threat 5 — Verifier Griefing (Endless Veto)

**Attack vector:** A malicious or extortionate verifier repeatedly vetoes every payout request, preventing funds from ever being disbursed.

**Mitigations:**
- The stall timeout (`stallTimeout`: 14–90 days) bounds the maximum delay. If `lastProgressAt` is not updated within `stallTimeout`, anyone can call `triggerStallRefund()`.
- `lastProgressAt` is updated only by `finalizeFundraising`, `executePayout`, and `submitDelivery` — the organizer cannot reset the clock with no-op actions.
- After stall refund is triggered, donors receive pro-rata refunds of remaining funds, limiting total damage.
- The veto is intentionally powerful (single veto kills a request) because false negatives (blocked legitimate payouts) are recoverable; false positives (approved fraudulent payouts) are not.

**Residual risk:** Maximum delay equals `stallTimeout`. With a 90-day stall timeout, a griefing verifier could delay a campaign for up to 90 days. Shorter stall timeouts reduce this but increase the risk of accidental stall triggering. Campaign creators should set `stallTimeout` appropriate to their expected disbursement timeline.

---

### Threat 6 — Reentrancy

**Attack vector:** A malicious ERC-20 token or a crafted callback during `safeTransfer` re-enters the contract and drains funds or corrupts state.

**Mitigations:**
- **Checks-Effects-Interactions (CEI):** All state changes are applied *before* external calls. For example, in `claimRefund`, `refundClaimed` is set and `refundedTotal` is incremented before the token transfer.
- **`nonReentrant` modifier** (OpenZeppelin `ReentrancyGuard`) on all functions that transfer tokens: `donate`, `executePayout`, `claimRefund`.
- **Pull-based refunds:** Donors call `claimRefund` individually; there is no loop over donor addresses. Each claim is an isolated, single-transfer operation.
- **Single immutable asset:** The contract accepts only one ERC-20 token (set at construction), eliminating cross-token reentrancy.

**Residual risk:** None known with current implementation. Future changes to OpenZeppelin dependencies or EVM behavior could introduce risk. All token interactions use `SafeERC20` wrappers.

---

### Threat 7 — Admin Rug

**Attack vector:** The admin (contract owner) uses privileged access to extract funds or block legitimate operations.

**Mitigations:**
- **No withdrawal path:** No function allows the owner to transfer escrowed tokens. `claimRefund` and `executePayout` are the only token-output paths, and both require specific preconditions the admin cannot manufacture alone.
- **No upgradeability:** The contract is not upgradeable. No proxy; no `delegatecall`; no `selfdestruct`. The admin cannot swap in a malicious implementation.
- **Immutable parameters:** Campaign rules (threshold, milestones, verifiers) cannot be changed after creation.
- **2-step ownership transfer:** `Ownable2Step` prevents accidental ownership loss; `renounceOwnership` reverts.
- **Pause cannot block refunds:** `pause()` blocks `donate`, `proposePayout`, `approvePayout`, and `executePayout`. It explicitly does **not** block `claimRefund`, `triggerStallRefund`, `finalizeFundraising`, `vetoPayout`, or `cancelPayout`.

**Residual risk:** The admin can pause the contract, preventing new donations and stalling pending payouts (until the challenge period or stall timeout occurs). The admin can also censor campaigns (by not creating them) and vendors (by not registering them). Production deployment should use a Safe multisig with time-locked admin actions.

---

### Threat 8 — Fee-on-Transfer / Malicious Token

**Attack vector:** A fee-on-transfer token is used, causing the contract to credit more than it received, creating a solvency shortfall. Or the token contract has a malicious `transferFrom` implementation.

**Mitigations:**
- **Single immutable asset:** The token address is set once at construction and never changed. No multi-token support eliminates token-switching attacks.
- **Balance-delta check in `donate`:** The contract records `balanceBefore` before `safeTransferFrom`, then `balanceAfter` afterward, and requires `balanceAfter - balanceBefore == amount`. Fee-on-transfer tokens are rejected with `FeeOnTransferNotAllowed`.
- **`SafeERC20`** handles non-standard ERC-20 return values.

**Residual risk:** The token issuer controls the MockUSDC contract. On testnet, this is the deployer EOA. Production would use real USDC, where the issuer has emergency pause powers. This is an accepted dependency on the token's security.

---

### Threat 9 — Rounding / Dust Exploits

**Attack vector:** An attacker crafts donations or refund amounts to exploit integer rounding and extract more than their pro-rata share.

**Mitigations:**
- **Floor division everywhere:** All calculations use Solidity's integer division, which always rounds down.
- **Exact final-milestone allocation:** The last milestone gets `raised - sum(others)`, ensuring allocations sum exactly to `raised` with no loss.
- **Dust stays in contract:** Any rounding remainder in refund calculations (`contributions * refundPool / raised`) stays in the contract permanently. The invariant `refundedTotal ≤ refundPool` is maintained.
- **Fuzz tests** verify that random donor amounts and refund pools never allow total refunds to exceed `refundPool`.
- **Invariant tests** verify this property continuously under random state transitions.

**Residual risk:** Dust accumulation in the contract is permanent. This is a known and accepted trade-off (the alternative — over-refunding to the last donor — would break the solvency invariant).

---

### Threat 10 — Donation Dilution / Front-Running

**Attack vector:** An attacker front-runs the fundraising window closing to dilute existing donors' refund shares, or times donations to manipulate milestone allocations.

**Mitigations:**
- **Fixed fundraising window:** Allocations are computed once at `finalizeFundraising()`. All donors who contribute before the deadline share the same allocation proportions.
- **No price/share mechanics:** Donors do not receive tokens or shares; they receive pro-rata refund rights based on their contribution fraction.
- **Fixed deadline:** The deadline cannot be extended post-creation.

**Residual risk:** None material. Front-running to donate just before deadline simply helps the campaign reach its goal (beneficial). Dilution is impossible as a later donor's pro-rata refund is proportionally smaller.

---

### Threat 11 — Evidence Spam / Log Bloat

**Attack vector:** An organizer submits maximum-length CID strings in every call to spam logs and inflate indexer storage, potentially making historical data unmanageable.

**Mitigations:**
- CID length is bounded at 128 bytes for all CID parameters (`proposePayout`, `vetoPayout`, `submitDelivery`). Attempts to submit longer CIDs revert with `InvalidCidLength`.
- Only the hash (`keccak256(cid)`) is stored on-chain. The full CID is emitted in an event but not stored in contract storage, minimizing persistent gas cost.

**Residual risk:** Maximum-length CID strings increase gas cost slightly per call. This is bounded and acceptable; the absolute maximum additional cost per transaction is known and small.

---

### Threat 12 — Indexer or Frontend Compromise

**Attack vector:** The Ponder indexer or the React frontend is compromised (supply chain attack, server hack, XSS), causing users to see false data or sign malicious transactions.

**Mitigations:**
- **Contract is source of truth:** All critical actions (donate, refund, approve, veto, execute) interact directly with the contract via wallet signatures. The indexer is read-only.
- **Refunds are always accessible:** Donors can call `claimRefund` directly (via Etherscan or any wallet) without the frontend or indexer being available.
- **Input sanitization:** All indexer and IPFS data is treated as untrusted; the frontend sanitizes before rendering. `dangerouslySetInnerHTML` is never used.
- **Strict CSP:** `vercel.json` includes a strict Content Security Policy.
- **No secrets in client:** `PINATA_JWT` and other server-side secrets are never included in the client bundle.
- **Evidence hash verification:** The frontend displays CIDs and provides a "verify hash" utility that recomputes `keccak256(cid)` and compares with the on-chain `invoiceHash`.

**Residual risk:** A compromised frontend cannot steal funds (wallet signatures required), but can mislead users into signing malicious transactions to other contracts. Users should always verify contract addresses and transaction details in their wallet before signing.

---

### Threat 13 — Illicit-Funds Donations

**Attack vector:** Funds from illegal sources are donated to gain apparent legitimacy through the platform.

**Mitigations (testnet prototype):**
- None on-chain. This is a testnet with mock tokens; there are no real funds.

**Residual risk:** This is explicitly out of scope for the testnet prototype. Any production deployment handling real funds would require legal review, compliance with anti-money laundering (AML) regulations, and potentially on-chain KYC verification. See §13 of the specification for roadmap notes.

---

## Threat Model Summary by Risk Level

| Risk Level | Threats | Status |
|---|---|---|
| **Mitigated (by design)** | 6, 7 (partial), 8, 9, 10, 11 | Strong on-chain mitigations; residual risk minimal or bounded |
| **Partially mitigated** | 1, 2, 4, 5, 12 | On-chain controls exist; human/off-chain layer required |
| **Accepted (out of scope)** | 3 (partial), 13 | Requires governance or legal infrastructure not built in v1 |
| **Requires production hardening** | 7 (admin pause censorship) | Multisig + timelock in production |

---

## Security Contact

This is a testnet prototype, not an audited production system. If you discover a security issue, please open a GitHub issue marked `[Security]`. **Do not use mainnet funds with this contract.**

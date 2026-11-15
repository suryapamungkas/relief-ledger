# ReliefLedger — Trust Assumptions & Limitations

> **Status:** Sepolia Testnet Prototype · Unaudited · Not intended for real funds

Smart contracts guarantee **accounting rules and authorization**, not **real-world ground truth**. This document states explicitly what ReliefLedger guarantees on-chain, what relies on human actors, and what remains outside v1 scope.

---

## 1. What the Smart Contract Guarantees (Trustless / Code-Enforced)

1. **Zero Admin Custody:** The owner (`Admin`) cannot withdraw, redirect, or sweep escrowed `MockUSDC` funds—even if the contract is paused or a campaign fails. Verified continuously by `invariant_AdminCannotExtractFunds`.
2. **Isolation Between Campaigns:** Campaign `i` cannot consume tokens belonging to Campaign `j`. Verified by `invariant_Solvency` and `invariant_CampaignAccountingAndState`.
3. **Immutable Campaign Rules:** Verifier list, approval threshold, milestone split (`milestoneBps`), deadline, challenge period, and stall timeout are immutable after `createCampaign`.
4. **No EOA Organizer Payouts:** Disbursements can move **only** to `isVendor[vendor] == true` addresses where `vendor != organizer` and `!isVerifier[id][vendor]`.
5. **Dual Approval + Challenge Delay:** Every vendor disbursement requires strict majority verifier approval (`threshold > verifiers.length / 2`) followed by `challengePeriod` (24h–7d) during which **any** single verifier can veto.
6. **Pull-Based Refund Sovereignty:** When a campaign enters `Refunding` or finishes with unspent `refundPool > 0`, donors withdraw pro-rata shares directly via `claimRefund(id)`—even while paused.

---

## 2. Explicit Human & Off-Chain Trust Assumptions

| Actor / Layer | Assumed Behavior | If Assumption Breaks | Mitigation / Bound |
|---|---|---|---|
| **Admin (`owner`)** | Honest curation of `isVendor` registry and campaign creation; uses Safe/multisig in real pilots. | Compromise allows registering a malicious vendor and creating a campaign pointing to it. | Compromised key still **cannot** drain existing campaigns (`invariant_AdminCannotExtractFunds`). |
| **Organizer + Quorum of Verifiers** | Independent committees verifying authentic supplier invoices and physical deliveries. | Collusion between organizer and `threshold` verifiers with a registered vendor can extract funds. | Public IPFS invoice + challenge window alerts non-colluding single verifier who can unilaterally `vetoPayout`. |
| **Single Verifier** | Reviews proposals offline; avoids griefing legitimate milestones. | One malicious verifier can repeatedly call `vetoPayout` to freeze disbursement. | `stallTimeout` (14–90 days) bounds lockup; anyone can call `triggerStallRefund` to unlock donor pro-rata refunds. |
| **Token Standard (`asset`)** | Standard ERC-20 without transfer fees or rebase side effects. | Fee-on-transfer token causes accounting mismatch. | Constructor binds immutable `asset`; `donate` verifies `received == amount` balance delta and reverts `FeeOnTransferNotAllowed`. |
| **IPFS / Pinata Availability** | Uploaded metadata, invoices, and delivery photos remain pinned on IPFS gateways. | Unpinned gateway content returns 404 in browsers. | Critical payout proof integrity (`keccak256(invoiceCid)`) stays on-chain permanently; users can verify CID hashes independently. |
| **Metadata Privacy** | Organizers and verifiers scrub EXIF / PII before uploading files. | GPS coordinates or beneficiary identities leak publicly via IPFS. | Prominent UI warning on upload form; SVG uploads banned; 5 MB limit enforced. |

---

## 3. Known Limitations of the v1 Prototype

1. **Testnet Only:** Uses `MockUSDC` with a public 24h cooldown faucet (`1000 USDC`) on Ethereum Sepolia.
2. **No Post-Deadline Donations:** Fundraising freezes at `donationDeadline` so milestone allocations compute deterministically once.
3. **Dust Retention on Floor Division:** Pro-rata refund division `(contribution * refundPool) / raised` rounds down in Solidity, leaving up to `(numDonors - 1)` base units (`0.000001 USDC` increments) in the contract to preserve solvency.
4. **No Off-Chain Identity / Sybil Resistance on Verifiers:** Donor due diligence of the listed organizer and verifier committee addresses remains external to the contract.

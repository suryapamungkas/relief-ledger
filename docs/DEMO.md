# ReliefLedger — Demo Walkthrough & Verification Guide

This walkthrough demonstrates the complete end-to-end disaster relief lifecycle on Sepolia (or a local Anvil fork).

---

## Prerequisites

1. Foundry (`forge`, `anvil`, `cast`) installed.
2. Node.js >= 20.
3. Optional: Funded Sepolia wallet, `SEPOLIA_RPC_URL`, and `PINATA_JWT` for live testnet broadcast & IPFS uploads.

---

## 1. Local Simulation (Zero External Keys Required)

Terminal 1 — start a local EVM node with realistic block time:
```bash
anvil --block-time 2
```

Terminal 2 — deploy contracts locally (using Foundry Anvil's public default test Account #0 key — **local dev only**) & inspect addresses:
```bash
cd contracts
export DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Run the seed script (update `Deploy.s.sol` / `.env` with the printed `MockUSDC` and `ReliefLedger` addresses first):
```bash
forge script script/SeedDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

---

## 2. Live Sepolia Testnet Deployment

1. Copy `.env.example` to `.env` and populate `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, and `ETHERSCAN_API_KEY`.
2. Deploy & verify:
   ```bash
   cd contracts
   forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify -vvvv
   ```
3. Record the deployed addresses & block number in `contracts/deployments/sepolia.json`, `indexer/.env`, and `web/.env`.
4. Seed demo campaigns:
   ```bash
   forge script script/SeedDemo.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
   ```

---

## 3. Running Indexer + Frontend

Start the indexer API (`http://localhost:3001`):
```bash
cd indexer
npm install
npm run dev
```

Verify reconciliation against on-chain contract views:
```bash
npm run reconcile
```

Start the animated React frontend (`http://localhost:5173`):
```bash
cd web
npm install
npm run dev
```

---

## 4. End-to-End 5-Minute Walkthrough

1. **Testnet Faucet & Contribution (`/` -> `/campaign/1`):**
   - Connect MetaMask on Sepolia (if on another network, click **Switch Network to Sepolia**).
   - Click **Claim 1,000 Test USDC** in the Donate card.
   - Enter donation amount -> click **Approve Exact USDC** -> confirm -> click **Donate to Campaign Escrow**.
2. **Fundraising Finalization (`/campaign/1`):**
   - Once `donationDeadline` elapses, anyone clicks **Finalize Fundraising Window** (triggers `Active` if goal met, else `Refunding`).
3. **Organizer Vendor Payout Proposal (`/organizer`):**
   - Switch to organizer account -> upload an invoice (or paste `ipfs://...`) -> **Submit Payout Proposal**.
4. **Verifier Multi-Sig + Challenge Cooldown (`/verifier`):**
   - Inspect invoice CID and click **Verify Hash** (`keccak256(cid) === on-chain invoiceHash`).
   - Switch to verifiers 1..threshold -> click **Approve Payout** until `ThresholdReached` starts the `challengePeriod` timer.
   - Optionally demonstrate defense: switch to another verifier -> click **Veto Request** with a reason CID.
5. **Execution, Delivery Proof & Completion (`/campaign/1` -> `/organizer`):**
   - After `challengePeriod` expires, anyone clicks **Execute Payout** -> USDC moves directly to vendor.
   - Organizer calls **Record Delivery & Advance Milestone** on `/organizer`.
   - When the final milestone delivery is submitted, any unspent balance enters `refundPool`, allowing donors to claim pro-rata leftovers on `/me`.

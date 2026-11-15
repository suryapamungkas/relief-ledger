/**
 * Reconciliation check: compares SQLite indexer state directly against on-chain contract views.
 * Exits with code 0 when consistent, code 1 when drift is detected or contract is not configured.
 */

import { CONTRACT_ADDRESS, publicClient } from "./config";
import { openDb } from "./db";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const STATUS_NAMES = ["Fundraising", "Active", "Completed", "Refunding"] as const;
const REQUEST_STATUS_NAMES = ["None", "Proposed", "Vetoed", "Cancelled", "Executed"] as const;

const RECONCILE_VIEW_ABI = [
  {
    type: "function",
    name: "campaignCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "requestCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getCampaign",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "organizer", type: "address" },
          { name: "status", type: "uint8" },
          { name: "currentMilestone", type: "uint8" },
          { name: "threshold", type: "uint8" },
          { name: "donationDeadline", type: "uint64" },
          { name: "challengePeriod", type: "uint64" },
          { name: "stallTimeout", type: "uint64" },
          { name: "lastProgressAt", type: "uint64" },
          { name: "minGoal", type: "uint256" },
          { name: "raised", type: "uint256" },
          { name: "disbursed", type: "uint256" },
          { name: "currentAvailable", type: "uint256" },
          { name: "paidInCurrentMilestone", type: "uint256" },
          { name: "refundPool", type: "uint256" },
          { name: "refundedTotal", type: "uint256" },
          { name: "openRequestId", type: "uint256" },
          { name: "metadataCid", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getRequest",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "campaignId", type: "uint256" },
          { name: "milestone", type: "uint8" },
          { name: "vendor", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "invoiceHash", type: "bytes32" },
          { name: "approvedAt", type: "uint64" },
          { name: "approvals", type: "uint8" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
] as const;

async function reconcile() {
  if (CONTRACT_ADDRESS.toLowerCase() === ZERO_ADDRESS) {
    console.error("[reconcile] No deployed contract address configured.");
    process.exit(1);
  }

  const db = openDb();
  let mismatches = 0;

  try {
    const campaignCount = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: RECONCILE_VIEW_ABI,
      functionName: "campaignCount",
    });

    for (let id = 1n; id <= campaignCount; id++) {
      const chainCampaign = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: RECONCILE_VIEW_ABI,
        functionName: "getCampaign",
        args: [id],
      });

      const dbRow = db
        .prepare("SELECT status, current_milestone, raised, disbursed, refund_pool, refunded_total FROM campaigns WHERE id = ?")
        .get(Number(id)) as
        | {
            status: string;
            current_milestone: number;
            raised: string;
            disbursed: string;
            refund_pool: string;
            refunded_total: string;
          }
        | undefined;

      if (!dbRow) {
        console.error(`[reconcile] Missing campaign #${id.toString()} in SQLite`);
        mismatches++;
        continue;
      }

      const chainStatus = STATUS_NAMES[chainCampaign.status] ?? "Unknown";
      const checks: Array<[string, string, string]> = [
        ["status", dbRow.status, chainStatus],
        ["currentMilestone", String(dbRow.current_milestone), String(chainCampaign.currentMilestone)],
        ["raised", dbRow.raised, chainCampaign.raised.toString()],
        ["disbursed", dbRow.disbursed, chainCampaign.disbursed.toString()],
        ["refundPool", dbRow.refund_pool, chainCampaign.refundPool.toString()],
        ["refundedTotal", dbRow.refunded_total, chainCampaign.refundedTotal.toString()],
      ];

      for (const [field, got, expected] of checks) {
        if (got !== expected) {
          console.error(
            `[reconcile] Campaign #${id.toString()} mismatch on ${field}: db=${got}, chain=${expected}`
          );
          mismatches++;
        }
      }
    }

    const requestCount = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: RECONCILE_VIEW_ABI,
      functionName: "requestCount",
    });

    for (let reqId = 1n; reqId <= requestCount; reqId++) {
      const chainReq = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: RECONCILE_VIEW_ABI,
        functionName: "getRequest",
        args: [reqId],
      });

      const dbRow = db
        .prepare("SELECT status, approvals, amount FROM requests WHERE id = ?")
        .get(Number(reqId)) as
        | { status: string; approvals: number; amount: string }
        | undefined;

      if (!dbRow) {
        console.error(`[reconcile] Missing request #${reqId.toString()} in SQLite`);
        mismatches++;
        continue;
      }

      const chainStatus = REQUEST_STATUS_NAMES[chainReq.status] ?? "Unknown";
      if (dbRow.status !== chainStatus) {
        console.error(
          `[reconcile] Request #${reqId.toString()} status mismatch: db=${dbRow.status}, chain=${chainStatus}`
        );
        mismatches++;
      }
      if (dbRow.approvals !== chainReq.approvals) {
        console.error(
          `[reconcile] Request #${reqId.toString()} approvals mismatch: db=${dbRow.approvals}, chain=${chainReq.approvals}`
        );
        mismatches++;
      }
      if (dbRow.amount !== chainReq.amount.toString()) {
        console.error(
          `[reconcile] Request #${reqId.toString()} amount mismatch: db=${dbRow.amount}, chain=${chainReq.amount.toString()}`
        );
        mismatches++;
      }
    }

    console.log(
      `[reconcile] Checked ${campaignCount.toString()} campaign(s) and ${requestCount.toString()} request(s). Mismatches: ${mismatches}`
    );
    process.exit(mismatches === 0 ? 0 : 1);
  } finally {
    db.close();
  }
}

reconcile().catch((err) => {
  console.error("[reconcile] Error:", err);
  process.exit(1);
});

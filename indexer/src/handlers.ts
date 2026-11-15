/**
 * Event handlers for the ReliefLedger indexer.
 */

import type { Db } from "./db";
import { keccak256, toBytes, type Log, type DecodeEventLogReturnType } from "viem";
import type { RELIEF_LEDGER_ABI } from "./abi";

type EventName = (typeof RELIEF_LEDGER_ABI)[number]["name"];

type DecodedLog<N extends EventName> = {
  eventName: N;
  args: Extract<
    DecodeEventLogReturnType<typeof RELIEF_LEDGER_ABI>,
    { eventName: N }
  >["args"];
};

interface LogMeta {
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  timestamp: number;
}

function meta(log: Log, timestamp: number): LogMeta {
  return {
    blockNumber: log.blockNumber ?? 0n,
    transactionHash: (log.transactionHash ?? "0x") as `0x${string}`,
    logIndex: log.logIndex ?? 0,
    timestamp,
  };
}

function addBigIntStrings(a: string, b: bigint): string {
  return (BigInt(a || "0") + b).toString();
}

export function handleVendorSet(db: Db, log: Log, decoded: DecodedLog<"VendorSet">, ts: number): void {
  const { vendor, allowed } = decoded.args as { vendor: string; allowed: boolean };
  const m = meta(log, ts);

  db.prepare(`
    INSERT INTO vendors (address, allowed, set_at_block, set_at_tx)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      allowed = excluded.allowed,
      set_at_block = excluded.set_at_block,
      set_at_tx = excluded.set_at_tx
  `).run(vendor.toLowerCase(), allowed ? 1 : 0, Number(m.blockNumber), m.transactionHash);
}

export function handleCampaignCreated(db: Db, log: Log, decoded: DecodedLog<"CampaignCreated">, ts: number): void {
  const args = decoded.args as {
    id: bigint;
    organizer: string;
    verifiers: string[];
    threshold: number;
    minGoal: bigint;
    donationDeadline: bigint;
    challengePeriod: bigint;
    stallTimeout: bigint;
    milestoneBps: number[];
    metadataCid: string;
  };
  const m = meta(log, ts);

  db.prepare(`
    INSERT OR IGNORE INTO campaigns (
      id, organizer, threshold, donation_deadline,
      challenge_period, stall_timeout, min_goal,
      milestone_bps, metadata_cid, verifiers,
      created_at_block, created_at_tx, created_at_ts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(args.id),
    args.organizer.toLowerCase(),
    args.threshold,
    Number(args.donationDeadline),
    Number(args.challengePeriod),
    Number(args.stallTimeout),
    args.minGoal.toString(),
    JSON.stringify(args.milestoneBps.map(Number)),
    args.metadataCid,
    JSON.stringify(args.verifiers.map((v) => v.toLowerCase())),
    Number(m.blockNumber),
    m.transactionHash,
    m.timestamp
  );
}

export function handleDonated(db: Db, log: Log, decoded: DecodedLog<"Donated">, ts: number): void {
  const args = decoded.args as { id: bigint; donor: string; amount: bigint };
  const m = meta(log, ts);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO donations (campaign_id, donor, amount, block_number, timestamp, tx_hash, log_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(args.id),
    args.donor.toLowerCase(),
    args.amount.toString(),
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );

  if (insert.changes > 0) {
    const row = db.prepare("SELECT raised FROM campaigns WHERE id = ?").get(Number(args.id)) as
      | { raised: string }
      | undefined;
    if (row) {
      db.prepare("UPDATE campaigns SET raised = ? WHERE id = ?").run(
        addBigIntStrings(row.raised, args.amount),
        Number(args.id)
      );
    }
  }

  db.prepare(`
    INSERT OR IGNORE INTO fund_flow (campaign_id, direction, flow_type, counterparty, amount, block_number, timestamp, tx_hash, log_index)
    VALUES (?, 'in', 'donation', ?, ?, ?, ?, ?, ?)
  `).run(
    Number(args.id),
    args.donor.toLowerCase(),
    args.amount.toString(),
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );
}

export function handleFundraisingFinalized(
  db: Db,
  _log: Log,
  decoded: DecodedLog<"FundraisingFinalized">,
  _ts: number
): void {
  const args = decoded.args as {
    id: bigint;
    success: boolean;
    raised: bigint;
    allocations: bigint[];
  };

  db.prepare(`
    UPDATE campaigns
    SET status = ?,
        raised = ?,
        finalized_success = ?,
        allocations = ?,
        refund_pool = CASE WHEN ? = 0 THEN ? ELSE refund_pool END
    WHERE id = ?
  `).run(
    args.success ? "Active" : "Refunding",
    args.raised.toString(),
    args.success ? 1 : 0,
    JSON.stringify(args.allocations.map((a) => a.toString())),
    args.success ? 1 : 0,
    args.raised.toString(),
    Number(args.id)
  );
}

export function handlePayoutProposed(db: Db, log: Log, decoded: DecodedLog<"PayoutProposed">, ts: number): void {
  const args = decoded.args as {
    id: bigint;
    requestId: bigint;
    milestone: number;
    vendor: string;
    amount: bigint;
    invoiceCid: string;
  };
  const m = meta(log, ts);
  const invoiceHash = keccak256(toBytes(args.invoiceCid));

  db.prepare(`
    INSERT OR IGNORE INTO requests (
      id, campaign_id, milestone, vendor, amount, invoice_cid, invoice_hash,
      status, block_number, timestamp, tx_hash, log_index
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Proposed', ?, ?, ?, ?)
  `).run(
    Number(args.requestId),
    Number(args.id),
    args.milestone,
    args.vendor.toLowerCase(),
    args.amount.toString(),
    args.invoiceCid,
    invoiceHash,
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );
}

export function handlePayoutApproved(db: Db, log: Log, decoded: DecodedLog<"PayoutApproved">, ts: number): void {
  const args = decoded.args as { requestId: bigint; verifier: string; approvals: number };
  const m = meta(log, ts);

  db.prepare("UPDATE requests SET approvals = ? WHERE id = ?").run(args.approvals, Number(args.requestId));

  db.prepare(`
    INSERT OR IGNORE INTO votes (request_id, verifier, vote_type, approvals, block_number, timestamp, tx_hash, log_index)
    VALUES (?, ?, 'approved', ?, ?, ?, ?, ?)
  `).run(
    Number(args.requestId),
    args.verifier.toLowerCase(),
    args.approvals,
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );
}

export function handleThresholdReached(
  db: Db,
  _log: Log,
  decoded: DecodedLog<"ThresholdReached">,
  _ts: number
): void {
  const args = decoded.args as { requestId: bigint; executableAt: bigint };

  const reqRow = db
    .prepare(
      "SELECT c.challenge_period FROM requests r JOIN campaigns c ON r.campaign_id = c.id WHERE r.id = ?"
    )
    .get(Number(args.requestId)) as { challenge_period: number } | undefined;

  const challengePeriod = reqRow?.challenge_period ?? 0;
  const approvedAt = Number(args.executableAt) - challengePeriod;

  db.prepare("UPDATE requests SET approved_at = ?, executable_at = ? WHERE id = ?").run(
    approvedAt,
    Number(args.executableAt),
    Number(args.requestId)
  );
}

export function handlePayoutVetoed(db: Db, log: Log, decoded: DecodedLog<"PayoutVetoed">, ts: number): void {
  const args = decoded.args as { requestId: bigint; verifier: string; reasonCid: string };
  const m = meta(log, ts);

  db.prepare("UPDATE requests SET status = 'Vetoed' WHERE id = ?").run(Number(args.requestId));

  db.prepare(`
    INSERT OR IGNORE INTO votes (request_id, verifier, vote_type, reason_cid, block_number, timestamp, tx_hash, log_index)
    VALUES (?, ?, 'vetoed', ?, ?, ?, ?, ?)
  `).run(
    Number(args.requestId),
    args.verifier.toLowerCase(),
    args.reasonCid,
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );
}

export function handlePayoutCancelled(_db: Db, _log: Log, decoded: DecodedLog<"PayoutCancelled">, _ts: number): void {
  const args = decoded.args as { requestId: bigint };
  _db.prepare("UPDATE requests SET status = 'Cancelled' WHERE id = ?").run(Number(args.requestId));
}

export function handlePayoutExecuted(db: Db, log: Log, decoded: DecodedLog<"PayoutExecuted">, ts: number): void {
  const args = decoded.args as { id: bigint; requestId: bigint; vendor: string; amount: bigint };
  const m = meta(log, ts);

  db.prepare("UPDATE requests SET status = 'Executed' WHERE id = ?").run(Number(args.requestId));

  const flowInsert = db.prepare(`
    INSERT OR IGNORE INTO fund_flow (campaign_id, direction, flow_type, counterparty, amount, block_number, timestamp, tx_hash, log_index)
    VALUES (?, 'out', 'payout', ?, ?, ?, ?, ?, ?)
  `).run(
    Number(args.id),
    args.vendor.toLowerCase(),
    args.amount.toString(),
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );

  if (flowInsert.changes > 0) {
    const row = db.prepare("SELECT disbursed FROM campaigns WHERE id = ?").get(Number(args.id)) as
      | { disbursed: string }
      | undefined;
    if (row) {
      db.prepare("UPDATE campaigns SET disbursed = ? WHERE id = ?").run(
        addBigIntStrings(row.disbursed, args.amount),
        Number(args.id)
      );
    }
  }
}

export function handleDeliverySubmitted(db: Db, log: Log, decoded: DecodedLog<"DeliverySubmitted">, ts: number): void {
  const args = decoded.args as { id: bigint; milestone: number; deliveryCid: string };
  const m = meta(log, ts);

  db.prepare(`
    INSERT OR IGNORE INTO deliveries (campaign_id, milestone, delivery_cid, block_number, timestamp, tx_hash, log_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(args.id),
    args.milestone,
    args.deliveryCid,
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );

  const campaign = db.prepare("SELECT milestone_bps FROM campaigns WHERE id = ?").get(Number(args.id)) as
    | { milestone_bps: string }
    | undefined;
  const totalMilestones = campaign ? (JSON.parse(campaign.milestone_bps) as number[]).length : 1;
  const nextMilestone = args.milestone + 1 < totalMilestones ? args.milestone + 1 : args.milestone;

  db.prepare("UPDATE campaigns SET current_milestone = ? WHERE id = ? AND current_milestone < ?").run(
    nextMilestone,
    Number(args.id),
    nextMilestone
  );
}

export function handleCampaignCompleted(
  db: Db,
  _log: Log,
  decoded: DecodedLog<"CampaignCompleted">,
  _ts: number
): void {
  const args = decoded.args as { id: bigint; refundPool: bigint };
  db.prepare("UPDATE campaigns SET status = 'Completed', refund_pool = ? WHERE id = ?").run(
    args.refundPool.toString(),
    Number(args.id)
  );
}

export function handleStallRefundTriggered(
  db: Db,
  _log: Log,
  decoded: DecodedLog<"StallRefundTriggered">,
  _ts: number
): void {
  const args = decoded.args as { id: bigint; refundPool: bigint };
  db.prepare("UPDATE campaigns SET status = 'Refunding', refund_pool = ? WHERE id = ?").run(
    args.refundPool.toString(),
    Number(args.id)
  );
}

export function handleRefunded(db: Db, log: Log, decoded: DecodedLog<"Refunded">, ts: number): void {
  const args = decoded.args as { id: bigint; donor: string; amount: bigint };
  const m = meta(log, ts);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO refunds (campaign_id, donor, amount, block_number, timestamp, tx_hash, log_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(args.id),
    args.donor.toLowerCase(),
    args.amount.toString(),
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );

  if (insert.changes > 0) {
    const row = db.prepare("SELECT refunded_total FROM campaigns WHERE id = ?").get(Number(args.id)) as
      | { refunded_total: string }
      | undefined;
    if (row) {
      db.prepare("UPDATE campaigns SET refunded_total = ? WHERE id = ?").run(
        addBigIntStrings(row.refunded_total, args.amount),
        Number(args.id)
      );
    }
  }

  db.prepare(`
    INSERT OR IGNORE INTO fund_flow (campaign_id, direction, flow_type, counterparty, amount, block_number, timestamp, tx_hash, log_index)
    VALUES (?, 'out', 'refund', ?, ?, ?, ?, ?, ?)
  `).run(
    Number(args.id),
    args.donor.toLowerCase(),
    args.amount.toString(),
    Number(m.blockNumber),
    m.timestamp,
    m.transactionHash,
    m.logIndex
  );
}

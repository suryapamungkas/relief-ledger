/**
 * Express REST API for the ReliefLedger indexer.
 * Exposes read-only endpoints consumed by the frontend and audit scripts.
 */

import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { isAddress } from "viem";
import type { Db } from "./db";
import { getLastIndexedBlock } from "./db";
import { CONTRACT_ADDRESS, chain } from "./config";

export interface RuntimeStatus {
  latestBlock: bigint;
  finalizedBlock: bigint;
  lastError: string | null;
  startedAt: number;
}

interface CampaignRow {
  id: number;
  organizer: string;
  status: string;
  current_milestone: number;
  threshold: number;
  donation_deadline: number;
  challenge_period: number;
  stall_timeout: number;
  min_goal: string;
  raised: string;
  disbursed: string;
  refund_pool: string;
  refunded_total: string;
  milestone_bps: string;
  metadata_cid: string;
  verifiers: string;
  finalized_success: number | null;
  allocations: string | null;
  created_at_block: number;
  created_at_tx: string;
  created_at_ts: number;
}

function serializeCampaign(row: CampaignRow) {
  return {
    id: row.id,
    organizer: row.organizer,
    status: row.status,
    currentMilestone: row.current_milestone,
    threshold: row.threshold,
    donationDeadline: row.donation_deadline,
    challengePeriod: row.challenge_period,
    stallTimeout: row.stall_timeout,
    minGoal: row.min_goal,
    raised: row.raised,
    disbursed: row.disbursed,
    refundPool: row.refund_pool,
    refundedTotal: row.refunded_total,
    milestoneBps: JSON.parse(row.milestone_bps) as number[],
    metadataCid: row.metadata_cid,
    verifiers: JSON.parse(row.verifiers) as string[],
    finalizedSuccess: row.finalized_success === null ? null : Boolean(row.finalized_success),
    allocations: row.allocations ? (JSON.parse(row.allocations) as string[]) : null,
    createdAtBlock: row.created_at_block,
    createdAtTx: row.created_at_tx,
    createdAtTs: row.created_at_ts,
  };
}

function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function createApi(db: Db, getRuntime: () => RuntimeStatus): Express {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN || "*";

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    const lastIndexedBlock = getLastIndexedBlock(db);
    const runtime = getRuntime();
    const lag =
      runtime.finalizedBlock > lastIndexedBlock
        ? Number(runtime.finalizedBlock - lastIndexedBlock)
        : 0;

    res.json({
      status: runtime.lastError ? "degraded" : "ok",
      chainId: chain.id,
      chainName: chain.name,
      contract: CONTRACT_ADDRESS,
      lastIndexedBlock: lastIndexedBlock.toString(),
      latestBlock: runtime.latestBlock.toString(),
      finalizedBlock: runtime.finalizedBlock.toString(),
      lagBlocks: lag,
      lastError: runtime.lastError,
      uptimeSeconds: Math.floor((Date.now() - runtime.startedAt) / 1000),
    });
  });

  app.get("/stats", (_req: Request, res: Response) => {
    const rows = db
      .prepare("SELECT status, raised, disbursed, refunded_total FROM campaigns")
      .all() as Array<{
      status: string;
      raised: string;
      disbursed: string;
      refunded_total: string;
    }>;

    let totalRaised = 0n;
    let totalDisbursed = 0n;
    let totalRefunded = 0n;
    let activeCampaigns = 0;
    let completedCampaigns = 0;
    let refundingCampaigns = 0;

    for (const r of rows) {
      totalRaised += BigInt(r.raised || "0");
      totalDisbursed += BigInt(r.disbursed || "0");
      totalRefunded += BigInt(r.refunded_total || "0");
      if (r.status === "Active" || r.status === "Fundraising") activeCampaigns++;
      else if (r.status === "Completed") completedCampaigns++;
      else if (r.status === "Refunding") refundingCampaigns++;
    }

    const donorRow = db
      .prepare("SELECT COUNT(DISTINCT donor) AS cnt FROM donations")
      .get() as { cnt: number };

    res.json({
      totalCampaigns: rows.length,
      activeCampaigns,
      completedCampaigns,
      refundingCampaigns,
      uniqueDonors: donorRow?.cnt ?? 0,
      totalRaised: totalRaised.toString(),
      totalDisbursed: totalDisbursed.toString(),
      totalRefunded: totalRefunded.toString(),
      totalEscrowed: (totalRaised - totalDisbursed - totalRefunded).toString(),
    });
  });

  app.get("/campaigns", (req: Request, res: Response) => {
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const validStatuses = new Set(["Fundraising", "Active", "Completed", "Refunding"]);

    const rows =
      status && validStatuses.has(status)
        ? (db
            .prepare("SELECT * FROM campaigns WHERE status = ? ORDER BY id DESC")
            .all(status) as CampaignRow[])
        : (db.prepare("SELECT * FROM campaigns ORDER BY id DESC").all() as CampaignRow[]);

    res.json({
      campaigns: rows.map(serializeCampaign),
    });
  });

  app.get("/campaigns/:id", (req: Request, res: Response) => {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid campaign id" });
      return;
    }

    const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as
      | CampaignRow
      | undefined;
    if (!row) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const donations = db
      .prepare(
        "SELECT id, donor, amount, block_number AS blockNumber, timestamp, tx_hash AS txHash, log_index AS logIndex FROM donations WHERE campaign_id = ? ORDER BY block_number DESC, log_index DESC"
      )
      .all(id);

    const requestRows = db
      .prepare(
        `SELECT id, campaign_id AS campaignId, milestone, vendor, amount,
                invoice_cid AS invoiceCid, invoice_hash AS invoiceHash, approvals,
                status, approved_at AS approvedAt, executable_at AS executableAt,
                block_number AS blockNumber, timestamp, tx_hash AS txHash, log_index AS logIndex
         FROM requests WHERE campaign_id = ? ORDER BY id DESC`
      )
      .all(id) as Array<Record<string, unknown>>;

    const votesStmt = db.prepare(
      `SELECT id, request_id AS requestId, verifier, vote_type AS voteType,
              reason_cid AS reasonCid, approvals, block_number AS blockNumber,
              timestamp, tx_hash AS txHash, log_index AS logIndex
       FROM votes WHERE request_id = ? ORDER BY block_number ASC, log_index ASC`
    );

    const requests = requestRows.map((r) => ({
      ...r,
      votes: votesStmt.all(r.id as number),
    }));

    const deliveries = db
      .prepare(
        "SELECT id, milestone, delivery_cid AS deliveryCid, block_number AS blockNumber, timestamp, tx_hash AS txHash, log_index AS logIndex FROM deliveries WHERE campaign_id = ? ORDER BY milestone ASC"
      )
      .all(id);

    const refunds = db
      .prepare(
        "SELECT id, donor, amount, block_number AS blockNumber, timestamp, tx_hash AS txHash, log_index AS logIndex FROM refunds WHERE campaign_id = ? ORDER BY block_number DESC, log_index DESC"
      )
      .all(id);

    const fundFlow = db
      .prepare(
        `SELECT id, campaign_id AS campaignId, direction, flow_type AS flowType,
                counterparty, amount, block_number AS blockNumber, timestamp,
                tx_hash AS txHash, log_index AS logIndex
         FROM fund_flow WHERE campaign_id = ? ORDER BY block_number DESC, log_index DESC`
      )
      .all(id);

    res.json({
      campaign: serializeCampaign(row),
      donations,
      requests,
      deliveries,
      refunds,
      fundFlow,
    });
  });

  app.get("/address/:addr", (req: Request, res: Response) => {
    const rawAddr = req.params.addr;
    if (!isAddress(rawAddr)) {
      res.status(400).json({ error: "Invalid EVM address" });
      return;
    }
    const addr = rawAddr.toLowerCase();

    const donations = db
      .prepare(
        `SELECT d.id, d.campaign_id AS campaignId, d.amount, d.block_number AS blockNumber,
                d.timestamp, d.tx_hash AS txHash, c.metadata_cid AS metadataCid, c.status AS campaignStatus
         FROM donations d
         JOIN campaigns c ON d.campaign_id = c.id
         WHERE d.donor = ?
         ORDER BY d.block_number DESC, d.log_index DESC`
      )
      .all(addr);

    const refunds = db
      .prepare(
        `SELECT r.id, r.campaign_id AS campaignId, r.amount, r.block_number AS blockNumber,
                r.timestamp, r.tx_hash AS txHash
         FROM refunds r WHERE r.donor = ? ORDER BY r.block_number DESC`
      )
      .all(addr);

    const organizedCampaigns = (
      db
        .prepare("SELECT * FROM campaigns WHERE organizer = ? ORDER BY id DESC")
        .all(addr) as CampaignRow[]
    ).map(serializeCampaign);

    const allCampaigns = db
      .prepare("SELECT * FROM campaigns ORDER BY id DESC")
      .all() as CampaignRow[];
    const verifierCampaigns = allCampaigns
      .filter((c) => (JSON.parse(c.verifiers) as string[]).includes(addr))
      .map(serializeCampaign);

    const votes = db
      .prepare(
        `SELECT v.id, v.request_id AS requestId, v.vote_type AS voteType, v.reason_cid AS reasonCid,
                v.approvals, v.block_number AS blockNumber, v.timestamp, v.tx_hash AS txHash,
                r.campaign_id AS campaignId, r.milestone
         FROM votes v
         JOIN requests r ON v.request_id = r.id
         WHERE v.verifier = ? ORDER BY v.block_number DESC`
      )
      .all(addr);

    const vendorRequests = db
      .prepare(
        `SELECT id, campaign_id AS campaignId, milestone, amount, invoice_cid AS invoiceCid,
                status, approved_at AS approvedAt, executable_at AS executableAt,
                block_number AS blockNumber, timestamp, tx_hash AS txHash
         FROM requests WHERE vendor = ? ORDER BY id DESC`
      )
      .all(addr);

    res.json({
      address: addr,
      donations,
      refunds,
      organizedCampaigns,
      verifierCampaigns,
      votes,
      vendorRequests,
    });
  });

  app.get("/vendors", (_req: Request, res: Response) => {
    const vendors = db
      .prepare(
        "SELECT address, allowed, set_at_block AS setAtBlock, set_at_tx AS setAtTx FROM vendors WHERE allowed = 1 ORDER BY set_at_block DESC"
      )
      .all();
    res.json({ vendors });
  });

  return app;
}

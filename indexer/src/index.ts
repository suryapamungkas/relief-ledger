/**
 * Main entrypoint for the ReliefLedger viem event indexer.
 * Features:
 * - Chunked eth_getLogs polling bounded by CONFIRMATIONS finality safety
 * - Parent block-hash verification to detect Sepolia chain reorganizations
 * - Atomic SQLite transactions per batch + full reorg resync recovery
 * - Express REST API server on API_PORT
 */

import { decodeEventLog, type Log } from "viem";
import { RELIEF_LEDGER_ABI } from "./abi";
import {
  API_PORT,
  CONFIRMATIONS,
  CONTRACT_ADDRESS,
  POLL_INTERVAL_MS,
  START_BLOCK,
  publicClient,
} from "./config";
import { createApi, type RuntimeStatus } from "./api";
import {
  getLastIndexedBlock,
  openDb,
  resetIndexedData,
  setLastIndexedBlock,
  type Db,
} from "./db";
import {
  handleCampaignCompleted,
  handleCampaignCreated,
  handleDeliverySubmitted,
  handleDonated,
  handleFundraisingFinalized,
  handlePayoutApproved,
  handlePayoutCancelled,
  handlePayoutExecuted,
  handlePayoutProposed,
  handlePayoutVetoed,
  handleRefunded,
  handleStallRefundTriggered,
  handleThresholdReached,
  handleVendorSet,
} from "./handlers";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_BLOCK_RANGE = 2000n;

function dispatchLog(db: Db, log: Log, timestamp: number): void {
  const decoded = decodeEventLog({
    abi: RELIEF_LEDGER_ABI,
    data: log.data,
    topics: log.topics,
    strict: false,
  });

  switch (decoded.eventName) {
    case "VendorSet":
      handleVendorSet(db, log, decoded as never, timestamp);
      break;
    case "CampaignCreated":
      handleCampaignCreated(db, log, decoded as never, timestamp);
      break;
    case "Donated":
      handleDonated(db, log, decoded as never, timestamp);
      break;
    case "FundraisingFinalized":
      handleFundraisingFinalized(db, log, decoded as never, timestamp);
      break;
    case "PayoutProposed":
      handlePayoutProposed(db, log, decoded as never, timestamp);
      break;
    case "PayoutApproved":
      handlePayoutApproved(db, log, decoded as never, timestamp);
      break;
    case "ThresholdReached":
      handleThresholdReached(db, log, decoded as never, timestamp);
      break;
    case "PayoutVetoed":
      handlePayoutVetoed(db, log, decoded as never, timestamp);
      break;
    case "PayoutCancelled":
      handlePayoutCancelled(db, log, decoded as never, timestamp);
      break;
    case "PayoutExecuted":
      handlePayoutExecuted(db, log, decoded as never, timestamp);
      break;
    case "DeliverySubmitted":
      handleDeliverySubmitted(db, log, decoded as never, timestamp);
      break;
    case "CampaignCompleted":
      handleCampaignCompleted(db, log, decoded as never, timestamp);
      break;
    case "StallRefundTriggered":
      handleStallRefundTriggered(db, log, decoded as never, timestamp);
      break;
    case "Refunded":
      handleRefunded(db, log, decoded as never, timestamp);
      break;
    default:
      break;
  }
}

async function checkForReorg(db: Db, lastIndexedBlock: bigint): Promise<boolean> {
  if (lastIndexedBlock === 0n) return false;
  const row = db
    .prepare("SELECT block_hash FROM block_hashes WHERE block_number = ?")
    .get(Number(lastIndexedBlock)) as { block_hash: string } | undefined;

  if (!row) return false;

  const chainBlock = await publicClient.getBlock({ blockNumber: lastIndexedBlock });
  if (chainBlock.hash !== row.block_hash) {
    console.warn(
      `[indexer] Chain reorg detected at block ${lastIndexedBlock.toString()}: expected ${row.block_hash}, got ${chainBlock.hash}. Resetting index from block ${START_BLOCK.toString()}.`
    );
    db.transaction(() => {
      resetIndexedData(db);
    })();
    return true;
  }
  return false;
}

async function fetchBlockTimestamps(logs: Log[]): Promise<Map<bigint, number>> {
  const uniqueBlocks = Array.from(
    new Set(logs.map((l) => l.blockNumber).filter((b): b is bigint => b !== null))
  );
  const tsMap = new Map<bigint, number>();
  for (const blockNumber of uniqueBlocks) {
    const blk = await publicClient.getBlock({ blockNumber });
    tsMap.set(blockNumber, Number(blk.timestamp));
  }
  return tsMap;
}

async function syncOnce(db: Db, runtime: RuntimeStatus): Promise<void> {
  const latestBlock = await publicClient.getBlockNumber();
  const finalizedBlock = latestBlock > CONFIRMATIONS ? latestBlock - CONFIRMATIONS : 0n;
  runtime.latestBlock = latestBlock;
  runtime.finalizedBlock = finalizedBlock;

  if (CONTRACT_ADDRESS.toLowerCase() === ZERO_ADDRESS) {
    return;
  }

  let cursor = getLastIndexedBlock(db);
  if (cursor > 0n) {
    const reorged = await checkForReorg(db, cursor);
    if (reorged) {
      cursor = START_BLOCK > 0n ? START_BLOCK - 1n : 0n;
    }
  } else {
    cursor = START_BLOCK > 0n ? START_BLOCK - 1n : 0n;
  }

  while (cursor < finalizedBlock) {
    const fromBlock = cursor + 1n;
    const toBlock =
      fromBlock + MAX_BLOCK_RANGE - 1n < finalizedBlock
        ? fromBlock + MAX_BLOCK_RANGE - 1n
        : finalizedBlock;

    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      fromBlock,
      toBlock,
    });

    const timestamps = await fetchBlockTimestamps(logs);
    const endBlock = await publicClient.getBlock({ blockNumber: toBlock });

    const applyBatch = db.transaction((batchLogs: Log[]) => {
      for (const log of batchLogs) {
        const ts = log.blockNumber !== null ? timestamps.get(log.blockNumber) ?? 0 : 0;
        dispatchLog(db, log, ts);
      }
      setLastIndexedBlock(db, toBlock, endBlock.hash ?? undefined);
    });

    applyBatch(logs);
    if (logs.length > 0) {
      console.log(
        `[indexer] Indexed ${logs.length} event(s) in blocks ${fromBlock.toString()}..${toBlock.toString()}`
      );
    }
    cursor = toBlock;
  }

  runtime.lastError = null;
}

async function main() {
  const db = openDb();
  const runtime: RuntimeStatus = {
    latestBlock: 0n,
    finalizedBlock: 0n,
    lastError: null,
    startedAt: Date.now(),
  };

  const app = createApi(db, () => runtime);
  const server = app.listen(API_PORT, () => {
    console.log(`[indexer] API listening on http://localhost:${API_PORT}`);
    console.log(`[indexer] Contract: ${CONTRACT_ADDRESS} | Start block: ${START_BLOCK.toString()}`);
  });

  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let syncing = false;

  const poll = async () => {
    if (stopped || syncing) return;
    syncing = true;
    try {
      await syncOnce(db, runtime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      runtime.lastError = msg;
      console.error("[indexer] Sync error:", msg);
    } finally {
      syncing = false;
      if (!stopped) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
  };

  await poll();

  const shutdown = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[indexer] Fatal error:", err);
  process.exit(1);
});

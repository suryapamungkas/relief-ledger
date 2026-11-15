/**
 * SQLite database setup for the ReliefLedger indexer.
 */

import Database from "better-sqlite3";
import { DB_PATH } from "./config";

export type Db = Database.Database;

export function openDb(): Db {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  return db;
}

export function resetIndexedData(db: Db): void {
  db.exec(`
    DELETE FROM fund_flow;
    DELETE FROM refunds;
    DELETE FROM deliveries;
    DELETE FROM votes;
    DELETE FROM requests;
    DELETE FROM donations;
    DELETE FROM campaigns;
    DELETE FROM vendors;
    DELETE FROM block_hashes;
    DELETE FROM indexer_state;
  `);
}

function applyMigrations(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS indexer_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS block_hashes (
      block_number INTEGER PRIMARY KEY,
      block_hash   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vendors (
      address      TEXT PRIMARY KEY,
      allowed      INTEGER NOT NULL DEFAULT 1,
      set_at_block INTEGER NOT NULL,
      set_at_tx    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id                   INTEGER PRIMARY KEY,
      organizer            TEXT NOT NULL,
      status               TEXT NOT NULL DEFAULT 'Fundraising',
      current_milestone    INTEGER NOT NULL DEFAULT 0,
      threshold            INTEGER NOT NULL,
      donation_deadline    INTEGER NOT NULL,
      challenge_period     INTEGER NOT NULL,
      stall_timeout        INTEGER NOT NULL,
      min_goal             TEXT NOT NULL,
      raised               TEXT NOT NULL DEFAULT '0',
      disbursed            TEXT NOT NULL DEFAULT '0',
      refund_pool          TEXT NOT NULL DEFAULT '0',
      refunded_total       TEXT NOT NULL DEFAULT '0',
      milestone_bps        TEXT NOT NULL,
      metadata_cid         TEXT NOT NULL,
      verifiers            TEXT NOT NULL,
      finalized_success    INTEGER,
      allocations          TEXT,
      created_at_block     INTEGER NOT NULL,
      created_at_tx        TEXT NOT NULL,
      created_at_ts        INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS donations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id  INTEGER NOT NULL REFERENCES campaigns(id),
      donor        TEXT NOT NULL,
      amount       TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp    INTEGER NOT NULL DEFAULT 0,
      tx_hash      TEXT NOT NULL,
      log_index    INTEGER NOT NULL,
      UNIQUE(tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_donations_donor    ON donations(donor);

    CREATE TABLE IF NOT EXISTS requests (
      id              INTEGER PRIMARY KEY,
      campaign_id     INTEGER NOT NULL REFERENCES campaigns(id),
      milestone       INTEGER NOT NULL,
      vendor          TEXT NOT NULL,
      amount          TEXT NOT NULL,
      invoice_cid     TEXT NOT NULL,
      invoice_hash    TEXT,
      approvals       INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'Proposed',
      approved_at     INTEGER,
      executable_at   INTEGER,
      block_number    INTEGER NOT NULL,
      timestamp       INTEGER NOT NULL DEFAULT 0,
      tx_hash         TEXT NOT NULL,
      log_index       INTEGER NOT NULL,
      UNIQUE(tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS idx_requests_campaign ON requests(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_requests_vendor   ON requests(vendor);

    CREATE TABLE IF NOT EXISTS votes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id   INTEGER NOT NULL REFERENCES requests(id),
      verifier     TEXT NOT NULL,
      vote_type    TEXT NOT NULL,
      reason_cid   TEXT,
      approvals    INTEGER,
      block_number INTEGER NOT NULL,
      timestamp    INTEGER NOT NULL DEFAULT 0,
      tx_hash      TEXT NOT NULL,
      log_index    INTEGER NOT NULL,
      UNIQUE(tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS idx_votes_request  ON votes(request_id);
    CREATE INDEX IF NOT EXISTS idx_votes_verifier ON votes(verifier);

    CREATE TABLE IF NOT EXISTS deliveries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id  INTEGER NOT NULL REFERENCES campaigns(id),
      milestone    INTEGER NOT NULL,
      delivery_cid TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp    INTEGER NOT NULL DEFAULT 0,
      tx_hash      TEXT NOT NULL,
      log_index    INTEGER NOT NULL,
      UNIQUE(tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS idx_deliveries_campaign ON deliveries(campaign_id);

    CREATE TABLE IF NOT EXISTS refunds (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id  INTEGER NOT NULL REFERENCES campaigns(id),
      donor        TEXT NOT NULL,
      amount       TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp    INTEGER NOT NULL DEFAULT 0,
      tx_hash      TEXT NOT NULL,
      log_index    INTEGER NOT NULL,
      UNIQUE(tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS idx_refunds_campaign ON refunds(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_refunds_donor    ON refunds(donor);

    CREATE TABLE IF NOT EXISTS fund_flow (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id  INTEGER REFERENCES campaigns(id),
      direction    TEXT NOT NULL,
      flow_type    TEXT NOT NULL,
      counterparty TEXT NOT NULL,
      amount       TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp    INTEGER NOT NULL DEFAULT 0,
      tx_hash      TEXT NOT NULL,
      log_index    INTEGER NOT NULL,
      UNIQUE(tx_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS idx_fund_flow_campaign     ON fund_flow(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_fund_flow_counterparty ON fund_flow(counterparty);
  `);
}

export function getLastIndexedBlock(db: Db): bigint {
  const row = db
    .prepare("SELECT value FROM indexer_state WHERE key = 'last_block'")
    .get() as { value: string } | undefined;
  return row ? BigInt(row.value) : 0n;
}

export function setLastIndexedBlock(db: Db, block: bigint, blockHash?: string): void {
  db.prepare(
    "INSERT OR REPLACE INTO indexer_state (key, value) VALUES ('last_block', ?)"
  ).run(block.toString());
  if (blockHash) {
    db.prepare(
      "INSERT OR REPLACE INTO block_hashes (block_number, block_hash) VALUES (?, ?)"
    ).run(Number(block), blockHash);
  }
}

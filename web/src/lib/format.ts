import { formatUnits, keccak256, parseUnits, toBytes } from "viem";
import { IPFS_GATEWAY } from "@/config/contracts";

function addCommas(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a bigint USDC amount (6 decimals) to a human-readable string using pure bigint/string math.
 */
export function formatUSDC(amount: bigint): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const formatted = formatUnits(abs, 6);
  const [rawInt = "0", rawFrac = ""] = formatted.split(".");

  if (abs >= 1_000_000_000_000n) {
    // >= 1,000,000.000000 USDC -> 1.23M
    const scaled = (abs * 100n) / 1_000_000_000_000n;
    const mInt = scaled / 100n;
    const mDec = (scaled % 100n).toString().padStart(2, "0");
    return `${negative ? "-" : ""}${addCommas(mInt.toString())}.${mDec}M`;
  }
  if (abs >= 1_000_000_000n) {
    // >= 1,000.000000 USDC -> 1.23K
    const scaled = (abs * 100n) / 1_000_000_000n;
    const kInt = scaled / 100n;
    const kDec = (scaled % 100n).toString().padStart(2, "0");
    return `${negative ? "-" : ""}${addCommas(kInt.toString())}.${kDec}K`;
  }

  const dec = rawFrac.padEnd(2, "0").slice(0, 2);
  return `${negative ? "-" : ""}${addCommas(rawInt)}.${dec}`;
}

/**
 * Format a raw USDC bigint to full 6-decimal precision without floating-point math.
 */
export function formatUSDCFull(amount: bigint): string {
  const formatted = formatUnits(amount, 6);
  const [intPart = "0", fracPart] = formatted.split(".");
  return fracPart ? `${addCommas(intPart)}.${fracPart}` : addCommas(intPart);
}

/**
 * Parse a decimal USDC input string safely to 6-decimal bigint using viem's parseUnits.
 */
export function parseUSDC(raw: string): bigint | null {
  const cleaned = raw.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(cleaned)) return null;
  try {
    return parseUnits(cleaned, 6);
  } catch {
    return null;
  }
}

/**
 * Truncate an address to 0x1234…5678 format.
 */
export function formatAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Format a unix timestamp (seconds) to a readable date string.
 */
export function formatDate(timestamp: bigint | number): string {
  const ts = typeof timestamp === "bigint" ? Number(timestamp) : timestamp;
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a duration in seconds to a human-readable countdown.
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Elapsed";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Calculate integer progress percentage from raised/goal using bigint arithmetic.
 */
export function progressPercent(raised: bigint, goal: bigint): number {
  if (goal <= 0n || raised <= 0n) return 0;
  const pct = (raised * 100n) / goal;
  return pct > 100n ? 100 : Number(pct);
}

/**
 * Validate and resolve an IPFS CID string safely to an https gateway URL.
 * Rejects script/data/non-CID schemes to guard against stored XSS via untrusted metadata.
 */
export function extractSafeCidPath(rawCid: string): string | null {
  const trimmed = rawCid.trim();
  if (!trimmed || trimmed.length > 128) return null;
  const stripped = trimmed.startsWith("ipfs://") ? trimmed.slice(7) : trimmed;
  // Allow standard CIDv0/CIDv1/path characters only (alphanumeric, -, _, ., /)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,126}$/.test(stripped)) return null;
  if (stripped.includes("..")) return null;
  return stripped;
}

export function safeIpfsGatewayUrl(rawCid: string): string | null {
  const safePath = extractSafeCidPath(rawCid);
  if (!safePath) return null;
  const base = IPFS_GATEWAY.endsWith("/") ? IPFS_GATEWAY : `${IPFS_GATEWAY}/`;
  return `${base}${safePath}`;
}

/**
 * Compute keccak256 hash of a CID string matching ReliefLedger.sol proposePayout invoiceHash.
 */
export function computeCidHash(cid: string): `0x${string}` {
  return keccak256(toBytes(cid));
}

const STATUS_LABELS = ["Fundraising", "Active", "Completed", "Refunding"] as const;
export type CampaignStatus = (typeof STATUS_LABELS)[number];

export function statusLabel(status: number): CampaignStatus {
  return STATUS_LABELS[status] ?? "Fundraising";
}

const REQUEST_STATUS_LABELS = ["None", "Proposed", "Vetoed", "Cancelled", "Executed"] as const;
export type RequestStatusLabel = (typeof REQUEST_STATUS_LABELS)[number];

export function requestStatusLabel(status: number): RequestStatusLabel {
  return REQUEST_STATUS_LABELS[status] ?? "None";
}

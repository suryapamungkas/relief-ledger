/**
 * Contract configuration for ReliefLedger indexer.
 * Address and start block are loaded from ../contracts/deployments/sepolia.json when available,
 * or from environment variables for local overrides.
 */

import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

interface DeploymentJson {
  deployBlock?: number;
  contracts?: {
    ReliefLedger?: string;
    MockUSDC?: string;
  };
  reliefLedger?: string;
  ReliefLedger?: string;
  mockUsdc?: string;
  MockUSDC?: string;
  address?: string;
}

function readDeploymentJson(): DeploymentJson | null {
  const candidatePaths = [
    path.resolve(__dirname, "../../contracts/deployments/sepolia.json"),
    path.resolve(__dirname, "../contracts/deployments/sepolia.json"),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8")) as DeploymentJson;
    }
  }
  return null;
}

function loadDeployedAddress(): `0x${string}` {
  if (process.env.RELIEF_LEDGER_ADDRESS) {
    return process.env.RELIEF_LEDGER_ADDRESS as `0x${string}`;
  }
  const json = readDeploymentJson();
  const addr =
    json?.contracts?.ReliefLedger ??
    json?.reliefLedger ??
    json?.ReliefLedger ??
    json?.address ??
    null;
  if (addr && addr !== "0x0000000000000000000000000000000000000000") {
    return addr as `0x${string}`;
  }
  console.warn("[config] No deployed ReliefLedger address found. Set RELIEF_LEDGER_ADDRESS or deploy first.");
  return "0x0000000000000000000000000000000000000000";
}

function loadMockUSDCAddress(): `0x${string}` {
  if (process.env.MOCK_USDC_ADDRESS) {
    return process.env.MOCK_USDC_ADDRESS as `0x${string}`;
  }
  const json = readDeploymentJson();
  const addr =
    json?.contracts?.MockUSDC ?? json?.mockUsdc ?? json?.MockUSDC ?? null;
  if (addr) return addr as `0x${string}`;
  return "0x0000000000000000000000000000000000000000";
}

function loadStartBlock(): bigint {
  if (process.env.START_BLOCK) return BigInt(process.env.START_BLOCK);
  const json = readDeploymentJson();
  return BigInt(json?.deployBlock ?? 0);
}

export const CONTRACT_ADDRESS = loadDeployedAddress();
export const MOCK_USDC_ADDRESS = loadMockUSDCAddress();
export const CONFIRMATIONS = BigInt(parseInt(process.env.CONFIRMATIONS ?? "2", 10));
export const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "12000", 10);
export const API_PORT = parseInt(process.env.PORT ?? "3001", 10);
export const RPC_URL = process.env.RPC_URL ?? process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
export const DB_PATH = process.env.DB_PATH ?? "./indexer.db";
export const START_BLOCK = loadStartBlock();

export const chain = sepolia;

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

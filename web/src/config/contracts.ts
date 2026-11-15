// Contract addresses — read from environment or fallback to placeholder
// After deploying, set VITE_RELIEF_LEDGER_ADDRESS and VITE_MOCK_USDC_ADDRESS

export const CONTRACT_ADDRESSES = {
  RELIEF_LEDGER: (import.meta.env["VITE_RELIEF_LEDGER_ADDRESS"] ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  MOCK_USDC: (import.meta.env["VITE_MOCK_USDC_ADDRESS"] ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

export const SEPOLIA_CHAIN_ID = 11155111;

export const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export function ipfsUrl(cid: string): string {
  return `${IPFS_GATEWAY}${cid}`;
}

export const MIN_DONATION = 1_000_000n; // 1 USDC (6 decimals)

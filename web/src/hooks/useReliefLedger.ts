import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { MOCK_USDC_ABI } from "@/abi/MockUSDC";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import type { Address } from "viem";

const RL_ADDRESS = CONTRACT_ADDRESSES.RELIEF_LEDGER;
const USDC_ADDRESS = CONTRACT_ADDRESSES.MOCK_USDC;

// ─── Campaign reads ───

export function useCampaignCount() {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "campaignCount",
  });
}

export function useCampaign(id: bigint | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "getCampaign",
    args: id !== undefined ? [id] : undefined,
    query: { enabled: id !== undefined },
  });
}

export function useVerifiers(id: bigint | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "getVerifiers",
    args: id !== undefined ? [id] : undefined,
    query: { enabled: id !== undefined },
  });
}

export function useAllocations(id: bigint | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "getAllocations",
    args: id !== undefined ? [id] : undefined,
    query: { enabled: id !== undefined },
  });
}

export function useBps(id: bigint | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "getBps",
    args: id !== undefined ? [id] : undefined,
    query: { enabled: id !== undefined },
  });
}

export function useRequest(requestId: bigint | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "getRequest",
    args: requestId !== undefined ? [requestId] : undefined,
    query: { enabled: requestId !== undefined },
  });
}

export function useClaimableRefund(id: bigint | undefined, donor: Address | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "claimableRefund",
    args: id !== undefined && donor ? [id, donor] : undefined,
    query: { enabled: id !== undefined && !!donor },
  });
}

export function useExecutableAt(requestId: bigint | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "executableAt",
    args: requestId !== undefined ? [requestId] : undefined,
    query: { enabled: requestId !== undefined },
  });
}

export function useContribution(id: bigint | undefined, donor: Address | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "contributions",
    args: id !== undefined && donor ? [id, donor] : undefined,
    query: { enabled: id !== undefined && !!donor },
  });
}

export function useIsVerifier(id: bigint | undefined, addr: Address | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "isVerifier",
    args: id !== undefined && addr ? [id, addr] : undefined,
    query: { enabled: id !== undefined && !!addr },
  });
}

export function useIsVendor(addr: Address | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "isVendor",
    args: addr ? [addr] : undefined,
    query: { enabled: !!addr },
  });
}

export function useHasVoted(requestId: bigint | undefined, addr: Address | undefined) {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "hasVoted",
    args: requestId !== undefined && addr ? [requestId, addr] : undefined,
    query: { enabled: requestId !== undefined && !!addr },
  });
}

export function useOwner() {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "owner",
  });
}

export function usePaused() {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "paused",
  });
}

export function useMinDonation() {
  return useReadContract({
    address: RL_ADDRESS,
    abi: RELIEF_LEDGER_ABI,
    functionName: "minDonation",
  });
}

// ─── USDC reads ───

export function useUSDCBalance(account: Address | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: !!account },
  });
}

export function useUSDCAllowance(owner: Address | undefined, spender: Address) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    query: { enabled: !!owner },
  });
}

// ─── Write hooks ───

export function useReliefLedgerWrite() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  return { writeContract, hash, isPending, isConfirming, isConfirmed, error, reset };
}

export function useUSDCWrite() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  return {
    writeContract,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
    approve: (spender: Address, amount: bigint) =>
      writeContract({
        address: USDC_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [spender, amount],
      }),
  };
}

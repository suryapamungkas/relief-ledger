import { useEffect, useState, useCallback } from "react";
import { usePublicClient } from "wagmi";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { statusLabel, type CampaignStatus } from "@/lib/format";

const INDEXER_URL = (import.meta.env.VITE_INDEXER_URL as string | undefined) || "";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export interface IndexedCampaign {
  id: number;
  organizer: string;
  status: CampaignStatus;
  currentMilestone: number;
  threshold: number;
  donationDeadline: number;
  challengePeriod: number;
  stallTimeout: number;
  minGoal: string;
  raised: string;
  disbursed: string;
  refundPool: string;
  refundedTotal: string;
  milestoneBps: number[];
  metadataCid: string;
  verifiers: string[];
  finalizedSuccess: boolean | null;
  allocations: string[] | null;
  createdAtBlock: number;
  createdAtTx: string;
  createdAtTs: number;
}

export interface IndexedVote {
  id: number;
  requestId: number;
  verifier: string;
  voteType: "approved" | "vetoed";
  reasonCid: string | null;
  approvals: number | null;
  blockNumber: number;
  timestamp: number;
  txHash: string;
}

export interface IndexedRequest {
  id: number;
  campaignId: number;
  milestone: number;
  vendor: string;
  amount: string;
  invoiceCid: string;
  invoiceHash: string | null;
  approvals: number;
  status: string;
  approvedAt: number | null;
  executableAt: number | null;
  blockNumber: number;
  timestamp: number;
  txHash: string;
  votes: IndexedVote[];
}

export interface IndexedFundFlow {
  id: number;
  campaignId: number;
  direction: "in" | "out";
  flowType: "donation" | "payout" | "refund";
  counterparty: string;
  amount: string;
  blockNumber: number;
  timestamp: number;
  txHash: string;
}

export interface IndexedDelivery {
  id: number;
  milestone: number;
  deliveryCid: string;
  blockNumber: number;
  timestamp: number;
  txHash: string;
}

export interface IndexedDonation {
  id: number;
  donor: string;
  amount: string;
  blockNumber: number;
  timestamp: number;
  txHash: string;
  campaignId?: number;
  metadataCid?: string;
  campaignStatus?: string;
}

export interface CampaignDetailData {
  campaign: IndexedCampaign;
  donations: IndexedDonation[];
  requests: IndexedRequest[];
  deliveries: IndexedDelivery[];
  refunds: IndexedDonation[];
  fundFlow: IndexedFundFlow[];
}

export interface ProtocolStats {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  refundingCampaigns: number;
  uniqueDonors: number;
  totalRaised: string;
  totalDisbursed: string;
  totalRefunded: string;
  totalEscrowed: string;
  source: "indexer" | "rpc" | "demo";
}

export interface AddressActivity {
  address: string;
  donations: IndexedDonation[];
  refunds: IndexedDonation[];
  organizedCampaigns: IndexedCampaign[];
  verifierCampaigns: IndexedCampaign[];
  votes: Array<IndexedVote & { campaignId: number; milestone: number }>;
  vendorRequests: IndexedRequest[];
}

async function fetchJson<T>(path: string): Promise<T | null> {
  if (!INDEXER_URL) return null;
  try {
    const res = await fetch(`${INDEXER_URL.replace(/\/$/, "")}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function isContractConfigured(): boolean {
  return CONTRACT_ADDRESSES.RELIEF_LEDGER.toLowerCase() !== ZERO_ADDR;
}

/**
 * Fetch campaigns list from indexer if configured/reachable, or directly from on-chain RPC views.
 */
export function useCampaignsList() {
  const publicClient = usePublicClient();
  const [campaigns, setCampaigns] = useState<IndexedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"indexer" | "rpc" | "unconfigured">("unconfigured");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const idx = await fetchJson<{ campaigns: IndexedCampaign[] }>("/campaigns");
      if (idx?.campaigns) {
        setCampaigns(idx.campaigns);
        setSource("indexer");
        return;
      }

      if (!isContractConfigured() || !publicClient) {
        setCampaigns([]);
        setSource("unconfigured");
        return;
      }

      const count = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
        abi: RELIEF_LEDGER_ABI,
        functionName: "campaignCount",
      });

      const list: IndexedCampaign[] = [];
      for (let i = count; i >= 1n; i--) {
        const [c, verifiers, bps, allocs] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "getCampaign",
            args: [i],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "getVerifiers",
            args: [i],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "getBps",
            args: [i],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "getAllocations",
            args: [i],
          }),
        ]);

        list.push({
          id: Number(i),
          organizer: c.organizer.toLowerCase(),
          status: statusLabel(c.status),
          currentMilestone: c.currentMilestone,
          threshold: c.threshold,
          donationDeadline: Number(c.donationDeadline),
          challengePeriod: Number(c.challengePeriod),
          stallTimeout: Number(c.stallTimeout),
          minGoal: c.minGoal.toString(),
          raised: c.raised.toString(),
          disbursed: c.disbursed.toString(),
          refundPool: c.refundPool.toString(),
          refundedTotal: c.refundedTotal.toString(),
          milestoneBps: bps.map(Number),
          metadataCid: c.metadataCid,
          verifiers: verifiers.map((v) => v.toLowerCase()),
          finalizedSuccess: c.status === 0 ? null : c.raised >= c.minGoal,
          allocations: allocs.length > 0 ? allocs.map((a) => a.toString()) : null,
          createdAtBlock: 0,
          createdAtTx: "0x",
          createdAtTs: 0,
        });
      }

      setCampaigns(list);
      setSource("rpc");
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { campaigns, loading, source, reload };
}

export function useProtocolStats() {
  const { campaigns, loading, source } = useCampaignsList();
  const [stats, setStats] = useState<ProtocolStats>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    completedCampaigns: 0,
    refundingCampaigns: 0,
    uniqueDonors: 0,
    totalRaised: "0",
    totalDisbursed: "0",
    totalRefunded: "0",
    totalEscrowed: "0",
    source: "rpc",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const idx = await fetchJson<Omit<ProtocolStats, "source">>("/stats");
      if (!cancelled && idx) {
        setStats({ ...idx, source: "indexer" });
        return;
      }

      let raised = 0n;
      let disbursed = 0n;
      let refunded = 0n;
      let active = 0;
      let completed = 0;
      let refunding = 0;

      for (const c of campaigns) {
        raised += BigInt(c.raised || "0");
        disbursed += BigInt(c.disbursed || "0");
        refunded += BigInt(c.refundedTotal || "0");
        if (c.status === "Active" || c.status === "Fundraising") active++;
        else if (c.status === "Completed") completed++;
        else if (c.status === "Refunding") refunding++;
      }

      if (!cancelled) {
        setStats({
          totalCampaigns: campaigns.length,
          activeCampaigns: active,
          completedCampaigns: completed,
          refundingCampaigns: refunding,
          uniqueDonors: 0,
          totalRaised: raised.toString(),
          totalDisbursed: disbursed.toString(),
          totalRefunded: refunded.toString(),
          totalEscrowed: (raised - disbursed - refunded).toString(),
          source: source === "indexer" ? "indexer" : "rpc",
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [campaigns, source]);

  return { stats, loading };
}

export function useCampaignIndexedDetail(campaignId: number) {
  const [detail, setDetail] = useState<CampaignDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!Number.isInteger(campaignId) || campaignId <= 0) return;
    setLoading(true);
    try {
      const data = await fetchJson<CampaignDetailData>(`/campaigns/${campaignId}`);
      setDetail(data);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { detail, loading, reload };
}

export function useAddressActivity(address: string | undefined) {
  const [activity, setActivity] = useState<AddressActivity | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!address) {
      setActivity(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchJson<AddressActivity>(`/address/${address}`);
      setActivity(data);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { activity, loading, reload };
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, usePublicClient } from "wagmi";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { usePaused } from "@/hooks/useReliefLedger";
import { isContractConfigured, useCampaignsList, type IndexedRequest } from "@/hooks/useIndexer";
import { PayoutRequestCard } from "@/components/campaign/PayoutRequestCard";
import { requestStatusLabel } from "@/lib/format";

interface VerifierTask {
  campaignId: number;
  threshold: number;
  request: IndexedRequest;
}

export function Verifier() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { campaigns, loading: campaignsLoading, reload: reloadCampaigns } = useCampaignsList();
  const { data: isPaused } = usePaused();

  const [tasks, setTasks] = useState<VerifierTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const myCampaigns = campaigns.filter(
    (c) => address && c.verifiers.some((v) => v.toLowerCase() === address.toLowerCase())
  );

  async function loadOpenRequests() {
    if (!address || !publicClient || !isContractConfigured() || myCampaigns.length === 0) {
      setTasks([]);
      return;
    }
    setLoadingTasks(true);
    try {
      const next: VerifierTask[] = [];
      for (const camp of myCampaigns) {
        const c = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
          abi: RELIEF_LEDGER_ABI,
          functionName: "getCampaign",
          args: [BigInt(camp.id)],
        });
        if (c.openRequestId === 0n) continue;

        const [req, execAt] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "getRequest",
            args: [c.openRequestId],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "executableAt",
            args: [c.openRequestId],
          }),
        ]);

        next.push({
          campaignId: camp.id,
          threshold: camp.threshold,
          request: {
            id: Number(c.openRequestId),
            campaignId: camp.id,
            milestone: Number(req.milestone),
            vendor: req.vendor,
            amount: req.amount.toString(),
            invoiceCid: `Campaign #${camp.id} · On-Chain Hash`,
            invoiceHash: req.invoiceHash,
            approvals: Number(req.approvals),
            status: requestStatusLabel(Number(req.status)),
            approvedAt: Number(req.approvedAt) || null,
            executableAt: Number(execAt) || null,
            blockNumber: 0,
            timestamp: 0,
            txHash: "0x",
            votes: [],
          },
        });
      }
      setTasks(next);
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    void loadOpenRequests();
  }, [address, myCampaigns.length, publicClient]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Verifier Queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review pending vendor payout requests on campaigns where you sit on the verifier committee. Any single verifier may veto suspicious requests during the challenge window.
        </p>
      </div>

      {campaignsLoading || loadingTasks ? (
        <div className="space-y-4">
          <div className="skeleton h-36 rounded-2xl" />
          <div className="skeleton h-36 rounded-2xl" />
        </div>
      ) : !address ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-700">
          Connect a verifier wallet on Sepolia to view assigned campaigns and open payout approvals.
        </div>
      ) : myCampaigns.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate-700">
          Your address (
          <code className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-800">
            {address}
          </code>
          ) is not listed on any campaign verifier committee.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-forest-700" aria-hidden="true" />
              Assigned Campaigns ({myCampaigns.length})
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {myCampaigns.map((c) => (
                <Link
                  key={c.id}
                  to={`/campaign/${c.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-brand-100"
                >
                  Campaign #{c.id} ({c.status})
                  <ArrowRight className="h-3.5 w-3.5 text-forest-700" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Open Payout Requests Requiring Action ({tasks.length})
            </h2>
            {tasks.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-sm text-slate-600">
                All assigned campaigns currently have zero pending payout proposals.
              </div>
            ) : (
              tasks.map((t) => (
                <div key={t.request.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Campaign #{t.campaignId}</span>
                    <Link
                      to={`/campaign/${t.campaignId}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      Open full campaign page for IPFS CID & Ledger
                    </Link>
                  </div>
                  <PayoutRequestCard
                    request={t.request}
                    threshold={t.threshold}
                    isOrganizer={false}
                    isVerifier={true}
                    isPaused={Boolean(isPaused)}
                    onActionSuccess={() => {
                      void loadOpenRequests();
                      void reloadCampaigns();
                    }}
                  />
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}

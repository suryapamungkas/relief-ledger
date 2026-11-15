import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccount, usePublicClient } from "wagmi";
import { ArrowLeft, AlertOctagon, CheckCircle2, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import {
  useAllocations,
  useBps,
  useCampaign,
  useClaimableRefund,
  useContribution,
  useExecutableAt,
  usePaused,
  useReliefLedgerWrite,
  useRequest,
  useVerifiers,
} from "@/hooks/useReliefLedger";
import { useCampaignIndexedDetail, type IndexedRequest } from "@/hooks/useIndexer";
import { decodeContractError, useTransactionState } from "@/hooks/useTransactionState";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { IpfsVerifyBadge } from "@/components/ui/IpfsVerifyBadge";
import { TransactionButton } from "@/components/ui/TransactionButton";
import { TxStatusModal } from "@/components/ui/TxStatusModal";
import { MilestoneTimeline } from "@/components/campaign/MilestoneTimeline";
import { DonateForm } from "@/components/campaign/DonateForm";
import { PayoutRequestCard } from "@/components/campaign/PayoutRequestCard";
import { FundFlowLedger } from "@/components/campaign/FundFlowLedger";
import {
  formatAddress,
  formatDate,
  formatUSDCFull,
  progressPercent,
  requestStatusLabel,
  statusLabel,
} from "@/lib/format";

export function CampaignDetail() {
  const { id: rawId } = useParams<{ id: string }>();
  const numericId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : 0;
  const campaignId = BigInt(numericId);
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { data: campaignRaw, isLoading, refetch: refetchCampaign } = useCampaign(
    numericId > 0 ? campaignId : undefined
  );
  const { data: verifiersRaw } = useVerifiers(numericId > 0 ? campaignId : undefined);
  const { data: bpsRaw } = useBps(numericId > 0 ? campaignId : undefined);
  const { data: allocationsRaw } = useAllocations(numericId > 0 ? campaignId : undefined);
  const { data: contribRaw, refetch: refetchContrib } = useContribution(
    numericId > 0 ? campaignId : undefined,
    address
  );
  const { data: claimableRaw, refetch: refetchClaimable } = useClaimableRefund(
    numericId > 0 ? campaignId : undefined,
    address
  );
  const { data: isPaused } = usePaused();
  const { detail, loading: idxLoading, reload: reloadIndexed } = useCampaignIndexedDetail(numericId);

  const openReqId = (campaignRaw?.openRequestId ?? 0n) as bigint;
  const { data: openReqRaw, refetch: refetchOpenReq } = useRequest(
    openReqId > 0n ? openReqId : undefined
  );
  const { data: execAtRaw } = useExecutableAt(openReqId > 0n ? openReqId : undefined);

  const write = useReliefLedgerWrite();
  const tx = useTransactionState();
  const [txTitle, setTxTitle] = useState("Campaign Action");

  useEffect(() => {
    if (write.hash && write.isConfirming) tx.setPending(write.hash);
    else if (write.hash && write.isConfirmed) {
      tx.setConfirmed(write.hash);
      void refetchCampaign();
      void refetchContrib();
      void refetchClaimable();
      void refetchOpenReq();
      void reloadIndexed();
    } else if (write.error) {
      const msg = decodeContractError(write.error);
      if (msg.toLowerCase().includes("rejected")) tx.setRejected(msg);
      else tx.setError(msg);
    }
  }, [write.hash, write.isConfirming, write.isConfirmed, write.error]);

  if (numericId <= 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <h1 className="text-xl font-bold text-white">Invalid Campaign ID</h1>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-brand-400">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>
      </div>
    );
  }

  if (isLoading && !detail?.campaign) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!campaignRaw && !detail?.campaign) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <h1 className="text-xl font-bold text-white">Campaign #{numericId} Not Found</h1>
        <p className="mt-2 text-sm text-slate-400">
          Ensure your wallet/RPC is connected to Sepolia and the contract address is set.
        </p>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-brand-400">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>
      </div>
    );
  }

  const statusCode = campaignRaw ? Number(campaignRaw.status) : 0;
  const status = campaignRaw ? statusLabel(statusCode) : detail!.campaign.status;
  const organizer = (campaignRaw?.organizer ?? detail!.campaign.organizer).toLowerCase();
  const verifiers = ((verifiersRaw as string[] | undefined) ?? detail?.campaign.verifiers ?? []).map((v) =>
    v.toLowerCase()
  );
  const threshold = campaignRaw ? Number(campaignRaw.threshold) : detail!.campaign.threshold;
  const deadline = campaignRaw ? Number(campaignRaw.donationDeadline) : detail!.campaign.donationDeadline;
  const challengePeriod = campaignRaw ? Number(campaignRaw.challengePeriod) : detail!.campaign.challengePeriod;
  const stallTimeout = campaignRaw ? Number(campaignRaw.stallTimeout) : detail!.campaign.stallTimeout;
  const lastProgressAt = campaignRaw ? Number(campaignRaw.lastProgressAt) : 0;
  const minGoal = campaignRaw ? campaignRaw.minGoal : BigInt(detail!.campaign.minGoal);
  const raised = campaignRaw ? campaignRaw.raised : BigInt(detail!.campaign.raised);
  const disbursed = campaignRaw ? campaignRaw.disbursed : BigInt(detail!.campaign.disbursed);
  const currentAvailable = campaignRaw ? campaignRaw.currentAvailable : 0n;
  const refundPool = campaignRaw ? campaignRaw.refundPool : BigInt(detail!.campaign.refundPool);
  const refundedTotal = campaignRaw ? campaignRaw.refundedTotal : BigInt(detail!.campaign.refundedTotal);
  const currentMilestone = campaignRaw
    ? Number(campaignRaw.currentMilestone)
    : detail!.campaign.currentMilestone;
  const metadataCid = campaignRaw?.metadataCid ?? detail!.campaign.metadataCid;
  const bps = ((bpsRaw as readonly number[] | undefined)?.map(Number) ??
    detail?.campaign.milestoneBps ??
    []) as number[];
  const allocations = ((allocationsRaw as readonly bigint[] | undefined) ??
    detail?.campaign.allocations?.map((a) => BigInt(a)) ??
    []) as bigint[];

  const myContrib = (contribRaw as bigint | undefined) ?? 0n;
  const claimable = (claimableRaw as bigint | undefined) ?? 0n;
  const isOrganizer = Boolean(address && address.toLowerCase() === organizer);
  const isVerifier = Boolean(address && verifiers.includes(address.toLowerCase()));

  const nowSec = Math.floor(Date.now() / 1000);
  const canFinalize = status === "Fundraising" && nowSec >= deadline;
  const stallTarget = lastProgressAt > 0 ? lastProgressAt + stallTimeout + 1 : 0;
  const canStallRefund = status === "Active" && stallTarget > 0 && nowSec > lastProgressAt + stallTimeout;

  // Build requests list: prefer indexed requests, or synthesize live on-chain open request fallback
  const requests: IndexedRequest[] = detail?.requests ?? [];
  if (requests.length === 0 && openReqRaw && openReqId > 0n) {
    requests.push({
      id: Number(openReqId),
      campaignId: numericId,
      milestone: Number(openReqRaw.milestone),
      vendor: openReqRaw.vendor,
      amount: openReqRaw.amount.toString(),
      invoiceCid: "Verified on-chain hash",
      invoiceHash: openReqRaw.invoiceHash,
      approvals: Number(openReqRaw.approvals),
      status: requestStatusLabel(Number(openReqRaw.status)),
      approvedAt: Number(openReqRaw.approvedAt) || null,
      executableAt: execAtRaw ? Number(execAtRaw) || null : null,
      blockNumber: 0,
      timestamp: 0,
      txHash: "0x",
      votes: [],
    });
  }

  async function runPermissionless(
    title: string,
    functionName: "finalizeFundraising" | "triggerStallRefund" | "claimRefund"
  ) {
    write.reset();
    setTxTitle(title);
    tx.setPrompt();
    try {
      if (publicClient && address) {
        await publicClient.simulateContract({
          address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
          abi: RELIEF_LEDGER_ABI,
          functionName,
          args: [campaignId],
          account: address,
        });
      }
      write.writeContract({
        address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
        abi: RELIEF_LEDGER_ABI,
        functionName,
        args: [campaignId],
      });
    } catch (err) {
      tx.setError(decodeContractError(err));
    }
  }

  const pct = progressPercent(raised, minGoal);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-brand-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to all campaigns
        </Link>

        <button
          type="button"
          onClick={() => {
            void refetchCampaign();
            void reloadIndexed();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-brand-500/40 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh State
        </button>
      </div>

      {/* Campaign Header */}
      <section className="glass rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-400">
                Campaign #{numericId}
              </span>
              <Badge label={status} variant={statusToBadgeVariant(statusCode)} />
            </div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Disaster Relief Operation #{numericId}
            </h1>
            <p className="text-xs text-slate-400">
              Organizer: <code className="text-slate-200">{organizer}</code> · Verifier Quorum:{" "}
              <strong className="text-white">
                {threshold} of {verifiers.length}
              </strong>{" "}
              · Challenge Period: <strong className="text-white">{Math.round(challengePeriod / 3600)}h</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {status === "Fundraising" && (
              <CountdownTimer targetTimestamp={deadline} label="Fundraising Ends" />
            )}
            {status === "Active" && stallTarget > 0 && (
              <CountdownTimer
                targetTimestamp={stallTarget}
                label="Stall Watch"
                elapsedText="Stall Guard Triggerable"
              />
            )}
          </div>
        </div>

        <IpfsVerifyBadge cid={metadataCid} label="Campaign Metadata Brief CID" />

        {/* Progress + KPI grid */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-lg font-bold text-white tabular-nums">
              {formatUSDCFull(raised)} USDC raised
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              Minimum Goal: {formatUSDCFull(minGoal)} USDC ({pct}%)
            </span>
          </div>
          <Progress value={pct} color={status === "Refunding" ? "amber" : "brand"} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5">
            <span className="text-xs text-slate-400">Disbursed</span>
            <p className="mt-1 text-base font-bold text-emerald-300 tabular-nums">
              {formatUSDCFull(disbursed)} USDC
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5">
            <span className="text-xs text-slate-400">Current Milestone Available</span>
            <p className="mt-1 text-base font-bold text-brand-300 tabular-nums">
              {formatUSDCFull(currentAvailable)} USDC
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5">
            <span className="text-xs text-slate-400">Refund Pool / Claimed</span>
            <p className="mt-1 text-base font-bold text-amber-300 tabular-nums">
              {formatUSDCFull(refundPool)} / {formatUSDCFull(refundedTotal)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5">
            <span className="text-xs text-slate-400">Your Contribution</span>
            <p className="mt-1 text-base font-bold text-white tabular-nums">
              {formatUSDCFull(myContrib)} USDC
            </p>
          </div>
        </div>

        {/* Permissionless lifecycle triggers & donor refund */}
        {(canFinalize || canStallRefund || claimable > 0n) && (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-800/80 pt-4">
            {canFinalize && (
              <TransactionButton
                loading={write.isPending}
                onClick={() => runPermissionless("Finalize Fundraising", "finalizeFundraising")}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Finalize Fundraising Window
              </TransactionButton>
            )}

            {canStallRefund && (
              <TransactionButton
                variant="danger"
                loading={write.isPending}
                onClick={() => runPermissionless("Trigger Stall Refund", "triggerStallRefund")}
              >
                <AlertOctagon className="h-4 w-4" aria-hidden="true" />
                Trigger Stall Refund Mode
              </TransactionButton>
            )}

            {claimable > 0n && (
              <TransactionButton
                variant="primary"
                loading={write.isPending}
                onClick={() => runPermissionless("Claim Pro-Rata Refund", "claimRefund")}
              >
                Claim Refund ({formatUSDCFull(claimable)} USDC)
              </TransactionButton>
            )}
          </div>
        )}
      </section>

      {/* Main two-column workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <MilestoneTimeline
            currentMilestone={currentMilestone}
            status={status}
            milestoneBps={bps}
            allocations={allocations}
            deliveries={detail?.deliveries ?? []}
          />

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Vendor Payout Requests ({requests.length})
            </h3>
            {requests.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-sm text-slate-400">
                No vendor payout requests proposed for this campaign yet.
              </div>
            ) : (
              requests.map((req) => (
                <PayoutRequestCard
                  key={req.id}
                  request={req}
                  threshold={threshold}
                  isOrganizer={isOrganizer}
                  isVerifier={isVerifier}
                  isPaused={Boolean(isPaused)}
                  onActionSuccess={() => {
                    void refetchCampaign();
                    void refetchOpenReq();
                    void reloadIndexed();
                  }}
                />
              ))
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-5">
          <DonateForm
            campaignId={campaignId}
            deadline={deadline}
            status={status}
            onSuccess={() => {
              void refetchCampaign();
              void refetchContrib();
              void reloadIndexed();
            }}
          />

          <div className="glass rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-brand-400" aria-hidden="true" />
              Verifier Committee ({threshold} of {verifiers.length})
            </div>
            <ul className="space-y-1.5 text-xs">
              {verifiers.map((v, i) => (
                <li
                  key={v}
                  className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/50 px-3 py-2 font-mono text-slate-300"
                >
                  <span>Verifier #{i + 1}</span>
                  <span>{formatAddress(v)}</span>
                </li>
              ))}
            </ul>
            <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Deadline: {formatDate(deadline)} · Stall timeout: {Math.round(stallTimeout / 86400)} days
            </div>
          </div>
        </aside>
      </div>

      <FundFlowLedger flows={detail?.fundFlow ?? []} loading={idxLoading} />

      <TxStatusModal tx={tx.state} actionTitle={txTitle} onClose={tx.reset} />
    </div>
  );
}

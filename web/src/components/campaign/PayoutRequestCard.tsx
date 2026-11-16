import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { Check, Play, ShieldAlert, XOctagon } from "lucide-react";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useHasVoted, useReliefLedgerWrite } from "@/hooks/useReliefLedger";
import { decodeContractError, useTransactionState } from "@/hooks/useTransactionState";
import { Badge, requestStatusToBadgeVariant } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { IpfsVerifyBadge } from "@/components/ui/IpfsVerifyBadge";
import { TransactionButton } from "@/components/ui/TransactionButton";
import { TxStatusModal } from "@/components/ui/TxStatusModal";
import { formatAddress, formatUSDCFull } from "@/lib/format";
import type { IndexedRequest } from "@/hooks/useIndexer";

interface PayoutRequestCardProps {
  request: IndexedRequest;
  threshold: number;
  isOrganizer: boolean;
  isVerifier: boolean;
  isPaused: boolean;
  onActionSuccess?: () => void;
}

const REQ_STATUS_MAP: Record<string, number> = {
  None: 0,
  Proposed: 1,
  Vetoed: 2,
  Cancelled: 3,
  Executed: 4,
};

export function PayoutRequestCard({
  request,
  threshold,
  isOrganizer,
  isVerifier,
  isPaused,
  onActionSuccess,
}: PayoutRequestCardProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const reqIdBigInt = BigInt(request.id);
  const { data: hasVotedChain } = useHasVoted(reqIdBigInt, address);
  const write = useReliefLedgerWrite();
  const tx = useTransactionState();

  const [vetoCid, setVetoCid] = useState("");
  const [showVetoBox, setShowVetoBox] = useState(false);
  const [actionTitle, setActionTitle] = useState("Execute Payout Action");

  const statusCode = REQ_STATUS_MAP[request.status] ?? 1;
  const pct = threshold > 0 ? Math.min(100, Math.round((request.approvals * 100) / threshold)) : 0;
  const thresholdMet = request.approvals >= threshold || Boolean(request.approvedAt);
  const nowSec = Math.floor(Date.now() / 1000);
  const challengeElapsed =
    Boolean(request.executableAt) && nowSec >= (request.executableAt ?? 0);

  useEffect(() => {
    if (write.hash && write.isConfirming) tx.setPending(write.hash);
    else if (write.hash && write.isConfirmed) {
      tx.setConfirmed(write.hash);
      setShowVetoBox(false);
      onActionSuccess?.();
    } else if (write.error) {
      const msg = decodeContractError(write.error);
      if (msg.toLowerCase().includes("rejected")) tx.setRejected(msg);
      else tx.setError(msg);
    }
  }, [write.hash, write.isConfirming, write.isConfirmed, write.error]);

  async function invoke(
    title: string,
    functionName: "approvePayout" | "vetoPayout" | "cancelPayout" | "executePayout",
    args: readonly unknown[]
  ) {
    write.reset();
    setActionTitle(title);
    tx.setPrompt();
    try {
      if (publicClient && address) {
        await publicClient.simulateContract({
          address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
          abi: RELIEF_LEDGER_ABI,
          functionName,
          args: args as never,
          account: address,
        });
      }
      write.writeContract({
        address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
        abi: RELIEF_LEDGER_ABI,
        functionName,
        args: args as never,
      });
    } catch (err) {
      tx.setError(decodeContractError(err));
    }
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            Request #{request.id} · Milestone {request.milestone + 1}
          </span>
          <h4 className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
            {formatUSDCFull(BigInt(request.amount))} USDC
          </h4>
          <p className="text-xs text-slate-600">
            Vendor:{" "}
            <code className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-slate-900">
              {formatAddress(request.vendor)}
            </code>
          </p>
        </div>

        <Badge
          label={
            request.status === "Proposed" && thresholdMet
              ? challengeElapsed
                ? "Ready to Execute"
                : "Challenge Window"
              : request.status
          }
          variant={requestStatusToBadgeVariant(statusCode)}
        />
      </div>

      <IpfsVerifyBadge
        cid={request.invoiceCid}
        expectedHash={request.invoiceHash}
        label="Vendor Invoice CID"
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Verifier Approvals</span>
          <span className="font-semibold text-slate-900 tabular-nums">
            {request.approvals} / {threshold} required
          </span>
        </div>
        <Progress
          value={pct}
          color={request.status === "Vetoed" ? "amber" : thresholdMet ? "accent" : "brand"}
        />
      </div>

      {request.executableAt && request.status === "Proposed" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CountdownTimer
            targetTimestamp={request.executableAt}
            label="Challenge Cooldown"
            elapsedText="Challenge Period Elapsed"
          />
        </div>
      )}

      {request.votes.length > 0 && (
        <div className="space-y-1.5 border-t border-brand-100 pt-3 text-xs">
          <span className="block font-semibold text-slate-700">Verifier Votes</span>
          {request.votes.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 text-slate-700">
              <span className="font-mono">{formatAddress(v.verifier)}</span>
              <span
                className={
                  v.voteType === "approved"
                    ? "font-semibold text-forest-700"
                    : "font-semibold text-rose-700"
                }
              >
                {v.voteType === "approved" ? "Approved" : `Vetoed (${v.reasonCid ?? ""})`}
              </span>
            </div>
          ))}
        </div>
      )}

      {request.status === "Proposed" && (
        <div className="flex flex-wrap gap-2 border-t border-brand-100 pt-3">
          {isVerifier && !thresholdMet && !Boolean(hasVotedChain) && (
            <TransactionButton
              size="sm"
              variant="forest"
              disabled={isPaused}
              loading={write.isPending}
              onClick={() => invoke(`Approve Request #${request.id}`, "approvePayout", [reqIdBigInt])}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Approve Payout
            </TransactionButton>
          )}

          {isVerifier && (
            <TransactionButton
              size="sm"
              variant="danger"
              onClick={() => setShowVetoBox((v) => !v)}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Veto Request
            </TransactionButton>
          )}

          {isOrganizer && (
            <TransactionButton
              size="sm"
              variant="secondary"
              loading={write.isPending}
              onClick={() => invoke(`Cancel Request #${request.id}`, "cancelPayout", [reqIdBigInt])}
            >
              <XOctagon className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel Request
            </TransactionButton>
          )}

          {thresholdMet && challengeElapsed && (
            <TransactionButton
              size="sm"
              variant="forest"
              disabled={isPaused}
              loading={write.isPending}
              onClick={() => invoke(`Execute Payout #${request.id}`, "executePayout", [reqIdBigInt])}
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Execute Payout
            </TransactionButton>
          )}
        </div>
      )}

      {showVetoBox && request.status === "Proposed" && (
        <div className="space-y-2 rounded-xl border border-rose-300 bg-rose-50 p-3">
          <label htmlFor={`veto-${request.id}`} className="block text-xs font-semibold text-rose-900">
            Veto Reason CID (1–128 chars, recorded on-chain)
          </label>
          <input
            id={`veto-${request.id}`}
            type="text"
            value={vetoCid}
            onChange={(e) => setVetoCid(e.target.value)}
            placeholder="ipfs://QmReason…"
            className="rl-input w-full rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs text-slate-900"
          />
          <div className="flex justify-end gap-2">
            <TransactionButton
              size="sm"
              variant="danger"
              disabled={vetoCid.trim().length === 0 || vetoCid.trim().length > 128}
              onClick={() =>
                invoke(`Veto Request #${request.id}`, "vetoPayout", [reqIdBigInt, vetoCid.trim()])
              }
            >
              Submit On-Chain Veto
            </TransactionButton>
          </div>
        </div>
      )}

      <TxStatusModal tx={tx.state} actionTitle={actionTitle} onClose={tx.reset} />
    </div>
  );
}

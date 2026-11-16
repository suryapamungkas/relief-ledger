import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { isAddress } from "viem";
import { KeyRound, PauseCircle, PlayCircle, PlusCircle, ShieldAlert, UserCheck } from "lucide-react";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useOwner, usePaused, useReliefLedgerWrite } from "@/hooks/useReliefLedger";
import { decodeContractError, useTransactionState } from "@/hooks/useTransactionState";
import { TransactionButton } from "@/components/ui/TransactionButton";
import { TxStatusModal } from "@/components/ui/TxStatusModal";
import { parseUSDC } from "@/lib/format";

export function Admin() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: ownerAddr, refetch: refetchOwner } = useOwner();
  const { data: pendingOwnerAddr, refetch: refetchPending } = useReadContract({
    address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
    abi: RELIEF_LEDGER_ABI,
    functionName: "pendingOwner",
  });
  const { data: isPaused, refetch: refetchPaused } = usePaused();
  const write = useReliefLedgerWrite();
  const tx = useTransactionState();
  const [txTitle, setTxTitle] = useState("Admin Operation");

  // Vendor allowlist form
  const [vendorAddr, setVendorAddr] = useState("");
  const [vendorAllowed, setVendorAllowed] = useState(true);

  // Create campaign form
  const [organizer, setOrganizer] = useState("");
  const [minGoalStr, setMinGoalStr] = useState("1000");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [verifiersCsv, setVerifiersCsv] = useState("");
  const [thresholdStr, setThresholdStr] = useState("2");
  const [challengeHours, setChallengeHours] = useState("24");
  const [stallDays, setStallDays] = useState("14");
  const [bpsCsv, setBpsCsv] = useState("4000,6000");
  const [metadataCid, setMetadataCid] = useState("ipfs://QmDemoReliefCampaign");

  // Ownership transfer
  const [newOwner, setNewOwner] = useState("");

  useEffect(() => {
    if (write.hash && write.isConfirming) tx.setPending(write.hash);
    else if (write.hash && write.isConfirmed) {
      tx.setConfirmed(write.hash);
      void refetchOwner();
      void refetchPending();
      void refetchPaused();
    } else if (write.error) {
      const msg = decodeContractError(write.error);
      if (msg.toLowerCase().includes("rejected")) tx.setRejected(msg);
      else tx.setError(msg);
    }
  }, [write.hash, write.isConfirming, write.isConfirmed, write.error]);

  const ownerStr = (ownerAddr as string | undefined) ?? "";
  const pendingStr = (pendingOwnerAddr as string | undefined) ?? "";
  const isOwner = Boolean(address && ownerStr && address.toLowerCase() === ownerStr.toLowerCase());
  const isPendingOwner = Boolean(
    address && pendingStr && address.toLowerCase() === pendingStr.toLowerCase()
  );

  async function callAdmin(
    title: string,
    functionName:
      | "setVendor"
      | "pause"
      | "unpause"
      | "createCampaign"
      | "transferOwnership"
      | "acceptOwnership",
    args: readonly unknown[] = []
  ) {
    if (!address) return;
    write.reset();
    setTxTitle(title);
    tx.setPrompt();
    try {
      if (publicClient) {
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

  function handleCreateCampaign() {
    const goal = parseUSDC(minGoalStr);
    const verifiers = verifiersCsv
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => isAddress(s)) as `0x${string}`[];
    const bps = bpsCsv
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    const bpsSum = bps.reduce((acc, v) => acc + v, 0);

    if (!isAddress(organizer) || !goal || verifiers.length < 3 || bpsSum !== 10000) {
      tx.setError(
        "Check organizer address, goal, >=3 verifier addresses, and milestone BPS summing to 10000."
      );
      return;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = now + BigInt(Math.max(1, Number(deadlineDays)) * 86400);
    const challengeSec = BigInt(Math.max(24, Number(challengeHours)) * 3600);
    const stallSec = BigInt(Math.max(14, Number(stallDays)) * 86400);

    void callAdmin("Create Relief Campaign", "createCampaign", [
      {
        organizer: organizer as `0x${string}`,
        minGoal: goal,
        donationDeadline: deadline,
        verifiers,
        threshold: Number(thresholdStr) || 2,
        challengePeriod: challengeSec,
        stallTimeout: stallSec,
        milestoneBps: bps,
        metadataCid: metadataCid.trim(),
      },
    ]);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Protocol Admin Console</h1>
        <p className="mt-1 text-sm text-slate-600">
          Owner capabilities are strictly scoped: register verified vendors, create campaigns, pause new deposits/approvals, and 2-step ownership transfer. Admin cannot withdraw or redirect escrowed USDC.
        </p>
      </div>

      {isPendingOwner && !isOwner && (
        <div className="glass rounded-2xl border border-brand-500 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">Pending Ownership Acceptance</h2>
            <p className="text-xs text-slate-600">
              Your wallet is nominated as pendingOwner. Accept ownership to complete 2-step transfer.
            </p>
          </div>
          <TransactionButton variant="forest" onClick={() => void callAdmin("Accept Ownership", "acceptOwnership")}>
            Accept Ownership
          </TransactionButton>
        </div>
      )}

      {!isOwner ? (
        <div className="glass rounded-2xl p-8 text-center space-y-3">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-900">Owner-Only Gate</h2>
          <p className="mx-auto max-w-lg text-sm text-slate-600">
            Admin actions are restricted to the contract owner (
            <code className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-slate-900">
              {ownerStr || "Not configured"}
            </code>
            ). Connected address:{" "}
            <code className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-slate-900">
              {address ?? "None"}
            </code>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Emergency Pause + Vendor Registry */}
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Circuit Breaker</h2>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    isPaused
                      ? "border-rose-300 bg-rose-50 text-rose-800"
                      : "border-forest-600/35 bg-forest-50 text-forest-800"
                  }`}
                >
                  {isPaused ? "PAUSED" : "OPERATIONAL"}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Pausing blocks donations, proposals, approvals, and payouts while keeping refunds, vetoes, and cancellations open.
              </p>
              <div className="flex gap-3">
                <TransactionButton
                  variant={isPaused ? "forest" : "danger"}
                  onClick={() =>
                    void callAdmin(
                      isPaused ? "Unpause Protocol" : "Pause Protocol",
                      isPaused ? "unpause" : "pause"
                    )
                  }
                >
                  {isPaused ? (
                    <>
                      <PlayCircle className="h-4 w-4" aria-hidden="true" /> Unpause Contract
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-4 w-4" aria-hidden="true" /> Pause Contract
                    </>
                  )}
                </TransactionButton>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <UserCheck className="h-5 w-5 text-brand-700" aria-hidden="true" />
                Vendor Allowlist (`setVendor`)
              </div>
              <div>
                <label htmlFor="admin-vendor" className="block text-xs font-semibold text-slate-800 mb-1">
                  Vendor Address
                </label>
                <input
                  id="admin-vendor"
                  type="text"
                  value={vendorAddr}
                  onChange={(e) => setVendorAddr(e.target.value)}
                  placeholder="0x..."
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vendorAllowed}
                  onChange={(e) => setVendorAllowed(e.target.checked)}
                  className="h-4 w-4 accent-forest-700"
                />
                Allowlisted to receive disbursements
              </label>
              <TransactionButton
                fullWidth
                variant="primary"
                disabled={!isAddress(vendorAddr)}
                onClick={() =>
                  void callAdmin("Update Vendor Allowlist", "setVendor", [
                    vendorAddr as `0x${string}`,
                    vendorAllowed,
                  ])
                }
              >
                Save Vendor Status
              </TransactionButton>
            </div>

            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <KeyRound className="h-5 w-5 text-amber-700" aria-hidden="true" />
                2-Step Ownership Transfer
              </div>
              <input
                type="text"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="New Owner 0x..."
                className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
              />
              <TransactionButton
                variant="secondary"
                disabled={!isAddress(newOwner)}
                onClick={() =>
                  void callAdmin("Nominate New Owner", "transferOwnership", [
                    newOwner as `0x${string}`,
                  ])
                }
              >
                Nominate Pending Owner
              </TransactionButton>
            </div>
          </div>

          {/* Create Campaign */}
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <PlusCircle className="h-5 w-5 text-forest-700" aria-hidden="true" />
              Create Campaign
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-800 mb-1">Organizer Address</label>
                <input
                  type="text"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                  placeholder="0x..."
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Min Goal (USDC)</label>
                <input
                  type="text"
                  value={minGoalStr}
                  onChange={(e) => setMinGoalStr(e.target.value)}
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Fundraising Days</label>
                <input
                  type="number"
                  min={1}
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value)}
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Verifier Addresses (3–9 comma/space separated)
                </label>
                <textarea
                  rows={2}
                  value={verifiersCsv}
                  onChange={(e) => setVerifiersCsv(e.target.value)}
                  placeholder="0x..., 0x..., 0x..."
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Threshold (Strict Majority)
                </label>
                <input
                  type="number"
                  min={2}
                  value={thresholdStr}
                  onChange={(e) => setThresholdStr(e.target.value)}
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Challenge Window (24–168h)
                </label>
                <input
                  type="number"
                  min={24}
                  max={168}
                  value={challengeHours}
                  onChange={(e) => setChallengeHours(e.target.value)}
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Stall Timeout (14–90d)
                </label>
                <input
                  type="number"
                  min={14}
                  max={90}
                  value={stallDays}
                  onChange={(e) => setStallDays(e.target.value)}
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Milestone BPS (sum = 10000)
                </label>
                <input
                  type="text"
                  value={bpsCsv}
                  onChange={(e) => setBpsCsv(e.target.value)}
                  placeholder="3000,3000,4000"
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Metadata CID (1–128 chars)
                </label>
                <input
                  type="text"
                  value={metadataCid}
                  onChange={(e) => setMetadataCid(e.target.value)}
                  className="rl-input w-full rounded-xl border border-brand-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <TransactionButton fullWidth variant="forest" onClick={handleCreateCampaign}>
              Deploy Campaign On-Chain
            </TransactionButton>
          </div>
        </div>
      )}

      <TxStatusModal tx={tx.state} actionTitle={txTitle} onClose={tx.reset} />
    </div>
  );
}

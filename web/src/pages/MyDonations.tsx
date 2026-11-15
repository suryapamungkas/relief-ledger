import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, usePublicClient } from "wagmi";
import { ArrowRight, RefreshCcw, Wallet } from "lucide-react";
import { RELIEF_LEDGER_ABI } from "@/abi/ReliefLedger";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useCampaignCount, useReliefLedgerWrite } from "@/hooks/useReliefLedger";
import { isContractConfigured, useAddressActivity } from "@/hooks/useIndexer";
import { decodeContractError, useTransactionState } from "@/hooks/useTransactionState";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { TransactionButton } from "@/components/ui/TransactionButton";
import { TxStatusModal } from "@/components/ui/TxStatusModal";
import { formatDate, formatUSDCFull, statusLabel } from "@/lib/format";

interface OnChainPosition {
  id: number;
  statusCode: number;
  status: string;
  contribution: bigint;
  claimable: bigint;
}

export function MyDonations() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: campaignCount } = useCampaignCount();
  const { activity, loading: idxLoading, reload: reloadActivity } = useAddressActivity(address);

  const [positions, setPositions] = useState<OnChainPosition[]>([]);
  const [scanning, setScanning] = useState(false);

  const write = useReliefLedgerWrite();
  const tx = useTransactionState();
  const [txTitle, setTxTitle] = useState("Claim Refund");

  async function scanOnChainPositions() {
    if (!address || !publicClient || !isContractConfigured() || !campaignCount) {
      setPositions([]);
      return;
    }
    setScanning(true);
    try {
      const list: OnChainPosition[] = [];
      for (let i = 1n; i <= campaignCount; i++) {
        const [contrib, claimable, campaign] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "contributions",
            args: [i, address],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "claimableRefund",
            args: [i, address],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
            abi: RELIEF_LEDGER_ABI,
            functionName: "getCampaign",
            args: [i],
          }),
        ]);

        if (contrib > 0n || claimable > 0n) {
          const code = Number(campaign.status);
          list.push({
            id: Number(i),
            statusCode: code,
            status: statusLabel(code),
            contribution: contrib,
            claimable,
          });
        }
      }
      setPositions(list);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    void scanOnChainPositions();
  }, [address, campaignCount, publicClient]);

  useEffect(() => {
    if (write.hash && write.isConfirming) tx.setPending(write.hash);
    else if (write.hash && write.isConfirmed) {
      tx.setConfirmed(write.hash);
      void scanOnChainPositions();
      void reloadActivity();
    } else if (write.error) {
      const msg = decodeContractError(write.error);
      if (msg.toLowerCase().includes("rejected")) tx.setRejected(msg);
      else tx.setError(msg);
    }
  }, [write.hash, write.isConfirming, write.isConfirmed, write.error]);

  async function handleClaim(id: number) {
    if (!address) return;
    write.reset();
    setTxTitle(`Claim Refund · Campaign #${id}`);
    tx.setPrompt();
    try {
      if (publicClient) {
        await publicClient.simulateContract({
          address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
          abi: RELIEF_LEDGER_ABI,
          functionName: "claimRefund",
          args: [BigInt(id)],
          account: address,
        });
      }
      write.writeContract({
        address: CONTRACT_ADDRESSES.RELIEF_LEDGER,
        abi: RELIEF_LEDGER_ABI,
        functionName: "claimRefund",
        args: [BigInt(id)],
      });
    } catch (err) {
      tx.setError(decodeContractError(err));
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">My Donations & Refunds</h1>
          <p className="mt-1 text-sm text-slate-400">
            Reads your contributions and claimable pull-refunds directly from the Sepolia escrow contract—works even if the indexer is offline.
          </p>
        </div>
        {address && (
          <button
            type="button"
            onClick={() => void scanOnChainPositions()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-brand-500/40 cursor-pointer"
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Rescan Escrow
          </button>
        )}
      </div>

      {!address ? (
        <div className="glass rounded-2xl p-10 text-center">
          <Wallet className="mx-auto h-10 w-10 text-brand-400" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-white">Connect Your Wallet</h2>
          <p className="mt-1 text-sm text-slate-400">
            Connect the Sepolia address you donated from to view escrow balances and claim available refunds.
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">On-Chain Escrow Positions</h2>
            {scanning ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="skeleton h-36 rounded-2xl" />
                <div className="skeleton h-36 rounded-2xl" />
              </div>
            ) : positions.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">
                No contributions recorded on-chain for your connected address yet.{" "}
                <Link to="/" className="text-brand-400 hover:underline">
                  Explore open relief campaigns
                </Link>
                .
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {positions.map((pos) => (
                  <div key={pos.id} className="glass rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/campaign/${pos.id}`}
                          className="inline-flex items-center gap-1 text-base font-bold text-white hover:text-brand-300"
                        >
                          Campaign #{pos.id}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        <p className="mt-1 text-xs text-slate-400">
                          Total contributed:{" "}
                          <strong className="text-white tabular-nums">
                            {formatUSDCFull(pos.contribution)} USDC
                          </strong>
                        </p>
                      </div>
                      <Badge label={pos.status} variant={statusToBadgeVariant(pos.statusCode)} />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                      <div>
                        <span className="block text-[11px] text-slate-500">Claimable Refund</span>
                        <span className="text-sm font-bold text-amber-300 tabular-nums">
                          {formatUSDCFull(pos.claimable)} USDC
                        </span>
                      </div>
                      {pos.claimable > 0n && (
                        <TransactionButton
                          size="sm"
                          loading={write.isPending}
                          onClick={() => handleClaim(pos.id)}
                        >
                          Claim Refund
                        </TransactionButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Indexed Donation History</h2>
            {idxLoading ? (
              <div className="skeleton h-24 rounded-xl" />
            ) : !activity || activity.donations.length === 0 ? (
              <p className="text-sm text-slate-400">
                No indexed donation logs returned for this address yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800/80 text-sm">
                {activity.donations.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <Link
                        to={`/campaign/${d.campaignId}`}
                        className="font-semibold text-brand-300 hover:underline"
                      >
                        Campaign #{d.campaignId}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">
                        {d.timestamp ? formatDate(d.timestamp) : `Block #${d.blockNumber}`}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {formatUSDCFull(BigInt(d.amount))} USDC
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <TxStatusModal tx={tx.state} actionTitle={txTitle} onClose={tx.reset} />
    </div>
  );
}

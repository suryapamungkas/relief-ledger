import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { formatAddress, formatDate, formatUSDCFull } from "@/lib/format";
import type { IndexedFundFlow } from "@/hooks/useIndexer";

interface FundFlowLedgerProps {
  flows: IndexedFundFlow[];
  loading?: boolean;
}

export function FundFlowLedger({ flows, loading = false }: FundFlowLedgerProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return flows;
    if (filter === "in") return flows.filter((f) => f.direction === "in");
    if (filter === "payout") return flows.filter((f) => f.flowType === "payout");
    if (filter === "refund") return flows.filter((f) => f.flowType === "refund");
    return flows;
  }, [flows, filter]);

  const tabs = [
    { id: "all", label: "All Movements", count: flows.length },
    { id: "in", label: "Donations In", count: flows.filter((f) => f.direction === "in").length },
    { id: "payout", label: "Vendor Payouts", count: flows.filter((f) => f.flowType === "payout").length },
    { id: "refund", label: "Donor Refunds", count: flows.filter((f) => f.flowType === "refund").length },
  ];

  return (
    <section aria-labelledby="ledger-heading" className="glass rounded-2xl p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="ledger-heading" className="text-lg font-semibold text-slate-900">
            On-Chain Fund Flow Ledger
          </h3>
          <p className="text-xs text-slate-600">
            Single verifiable ledger pairing incoming USDC escrow deposits with outgoing vendor settlements and refunds.
          </p>
        </div>
        <Tabs
          tabs={tabs}
          activeId={filter}
          onChange={setFilter}
          ariaLabel="Filter fund flow movements"
          layoutId="fund-flow-tabs"
        />
      </div>

      {loading ? (
        <div className="space-y-2.5">
          <div className="skeleton h-10 rounded-xl" />
          <div className="skeleton h-10 rounded-xl" />
          <div className="skeleton h-10 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-brand-200 bg-brand-50/70 p-6 text-center text-sm text-slate-600">
          No indexed token movements for this filter yet. Connect the event indexer or wait for confirmed Sepolia events.
        </p>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="ledger-heading"
          className="rl-table-region rounded-xl border border-brand-200 bg-white"
        >
          <table className="rl-table text-left text-sm">
            <thead className="sticky top-0 border-b border-brand-200 bg-brand-50/95 text-xs uppercase tracking-wider text-brand-900">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Direction</th>
                <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                <th scope="col" className="px-4 py-3 font-semibold">Counterparty</th>
                <th scope="col" className="px-4 py-3 font-semibold">Amount (USDC)</th>
                <th scope="col" className="px-4 py-3 font-semibold">Time</th>
                <th scope="col" className="px-4 py-3 font-semibold">Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filtered.map((item) => {
                const isIn = item.direction === "in";
                return (
                  <tr key={item.id} className="hover:bg-brand-50/60 transition-colors">
                    <td data-label="Direction" className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          isIn
                            ? "border-forest-600/35 bg-forest-50 text-forest-800"
                            : "border-brand-300 bg-brand-50 text-brand-800"
                        }`}
                      >
                        {isIn ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {isIn ? "IN" : "OUT"}
                      </span>
                    </td>
                    <td data-label="Type" className="px-4 py-3 capitalize text-slate-800">
                      {item.flowType}
                    </td>
                    <td data-label="Counterparty" className="px-4 py-3 font-mono text-xs text-slate-700">
                      {formatAddress(item.counterparty)}
                    </td>
                    <td
                      data-label="Amount"
                      className={`px-4 py-3 font-mono tabular-nums ${
                        isIn ? "font-bold text-forest-700" : "font-semibold text-slate-900"
                      }`}
                    >
                      {isIn ? "+" : "-"}
                      {formatUSDCFull(BigInt(item.amount))}
                    </td>
                    <td data-label="Time" className="px-4 py-3 text-xs text-slate-600">
                      {item.timestamp > 0 ? formatDate(item.timestamp) : `Block #${item.blockNumber}`}
                    </td>
                    <td data-label="Transaction" className="px-4 py-3">
                      <a
                        href={`https://sepolia.etherscan.io/tx/${item.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        {formatAddress(item.txHash)}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

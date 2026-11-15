import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ChevronDown, CircleDot, Lock } from "lucide-react";
import { IpfsVerifyBadge } from "@/components/ui/IpfsVerifyBadge";
import { formatDate, formatUSDC } from "@/lib/format";
import type { IndexedDelivery } from "@/hooks/useIndexer";

interface MilestoneTimelineProps {
  currentMilestone: number;
  status: string;
  milestoneBps: number[];
  allocations: bigint[];
  deliveries: IndexedDelivery[];
}

export function MilestoneTimeline({
  currentMilestone,
  status,
  milestoneBps,
  allocations,
  deliveries,
}: MilestoneTimelineProps) {
  const [expanded, setExpanded] = useState<number | null>(currentMilestone);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">Milestone Tranches</h3>
          <p className="text-xs text-slate-400">
            Next tranche unlocks only after organizer submits delivery evidence on-chain.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 tabular-nums">
          {milestoneBps.length} Stages
        </span>
      </div>

      <ol className="space-y-3">
        {milestoneBps.map((bps, idx) => {
          const delivery = deliveries.find((d) => d.milestone === idx);
          const isCompleted = status === "Completed" || Boolean(delivery) || idx < currentMilestone;
          const isCurrent = status === "Active" && idx === currentMilestone && !delivery;
          const isOpen = expanded === idx;
          const alloc = allocations[idx] ?? 0n;

          return (
            <li
              key={idx}
              className={`rounded-xl border transition-colors ${
                isCurrent
                  ? "border-brand-500/40 bg-brand-950/20"
                  : isCompleted
                  ? "border-emerald-500/30 bg-emerald-950/15"
                  : "border-slate-800 bg-slate-900/50"
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : idx)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
                  ) : isCurrent ? (
                    <CircleDot className="h-5 w-5 shrink-0 text-brand-400" aria-hidden="true" />
                  ) : (
                    <Lock className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                  )}

                  <div>
                    <span className="block text-sm font-semibold text-white">
                      Milestone {idx + 1}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        ({(bps / 100).toFixed(2)}%)
                      </span>
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {alloc > 0n
                        ? `Allocation: ${formatUSDC(alloc)} USDC`
                        : "Allocation computed upon goal finalization"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isCompleted
                        ? "bg-emerald-500/15 text-emerald-300"
                        : isCurrent
                        ? "bg-brand-500/15 text-brand-300"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isCompleted ? "Delivered" : isCurrent ? "Unlocked" : "Locked"}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </motion.span>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden border-t border-slate-800/70"
                  >
                    <div className="space-y-3 p-4 text-xs text-slate-300">
                      {delivery ? (
                        <>
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Delivery Submitted</span>
                            <span>{formatDate(delivery.timestamp)}</span>
                          </div>
                          <IpfsVerifyBadge cid={delivery.deliveryCid} label="Delivery Proof CID" />
                        </>
                      ) : (
                        <p className="text-slate-400">
                          {isCurrent
                            ? "Currently active milestone. Organizer can propose vendor payouts up to available funds and submit delivery proof once goods are delivered."
                            : "This milestone remains locked until previous delivery evidence is recorded on-chain."}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

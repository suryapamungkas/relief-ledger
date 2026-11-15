import { CheckCircle2, ExternalLink, Loader2, ShieldAlert, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import type { TxState } from "@/hooks/useTransactionState";
import { formatAddress } from "@/lib/format";

interface TxStatusModalProps {
  tx: TxState;
  actionTitle: string;
  onClose: () => void;
}

/**
 * Interactive transaction lifecycle modal:
 * prompt (wallet signature) -> pending (mined check) -> confirmed / reverted / rejected.
 */
export function TxStatusModal({ tx, actionTitle, onClose }: TxStatusModalProps) {
  const open = tx.phase !== "idle";

  const stepMeta = {
    prompt: {
      icon: <Wallet className="h-8 w-8 text-brand-400" />,
      title: "Confirm in Wallet",
      subtitle: "Review parameters carefully and sign the transaction in your wallet.",
      accent: "border-brand-500/30 bg-brand-500/10",
    },
    pending: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-amber-400" />,
      title: "Transaction Pending",
      subtitle: "Submitted to Sepolia. Waiting for block confirmation…",
      accent: "border-amber-500/30 bg-amber-500/10",
    },
    confirmed: {
      icon: <CheckCircle2 className="h-8 w-8 text-emerald-400" />,
      title: "Transaction Confirmed",
      subtitle: "Your on-chain action succeeded and state is being refreshed.",
      accent: "border-emerald-500/30 bg-emerald-500/10",
    },
    reverted: {
      icon: <ShieldAlert className="h-8 w-8 text-rose-400" />,
      title: "Transaction Reverted",
      subtitle: tx.error || "The smart contract rejected this call.",
      accent: "border-rose-500/30 bg-rose-500/10",
    },
    rejected: {
      icon: <ShieldAlert className="h-8 w-8 text-slate-400" />,
      title: "Signature Cancelled",
      subtitle: tx.error || "Wallet signature was rejected before broadcasting.",
      accent: "border-slate-700 bg-slate-800/50",
    },
  }[tx.phase === "idle" ? "prompt" : tx.phase];

  const steps = ["Sign", "Mine", "Finalized"];
  const activeStep =
    tx.phase === "prompt" ? 0 : tx.phase === "pending" ? 1 : tx.phase === "confirmed" ? 2 : -1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={actionTitle}
      description="Sepolia transaction status"
    >
      <div className="space-y-5">
        <div className={`flex flex-col items-center rounded-2xl border p-6 text-center ${stepMeta.accent}`}>
          <motion.div
            key={tx.phase}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="mb-3"
          >
            {stepMeta.icon}
          </motion.div>
          <h3 className="text-base font-semibold text-white">{stepMeta.title}</h3>
          <p className="mt-1 text-sm text-slate-300">{stepMeta.subtitle}</p>
        </div>

        {/* Visual pipeline indicator */}
        <div className="grid grid-cols-3 gap-2">
          {steps.map((label, i) => {
            const done = activeStep >= i;
            return (
              <div key={label} className="space-y-1.5 text-center">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    tx.phase === "reverted" || tx.phase === "rejected"
                      ? i === 0
                        ? "bg-rose-500/60"
                        : "bg-slate-800"
                      : done
                      ? "bg-brand-400"
                      : "bg-slate-800"
                  }`}
                />
                <span className={`block text-[11px] font-medium ${done ? "text-brand-300" : "text-slate-500"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {tx.hash && (
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-2.5 text-xs">
            <span className="text-slate-400">Tx Hash</span>
            <a
              href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-brand-300 hover:text-brand-200"
            >
              {formatAddress(tx.hash)}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant={tx.phase === "confirmed" ? "primary" : "secondary"} onClick={onClose}>
            {tx.phase === "pending" || tx.phase === "prompt" ? "Hide Window" : "Close"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

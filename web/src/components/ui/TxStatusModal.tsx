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
      icon: <Wallet className="h-8 w-8 text-brand-700" />,
      title: "Confirm in Wallet",
      subtitle: "Review parameters carefully and sign the transaction in your wallet.",
      accent: "border-brand-300 bg-brand-50",
    },
    pending: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-amber-700" />,
      title: "Transaction Pending",
      subtitle: "Submitted to Sepolia. Waiting for block confirmation…",
      accent: "border-amber-300 bg-amber-50",
    },
    confirmed: {
      icon: <CheckCircle2 className="h-8 w-8 text-forest-700" />,
      title: "Transaction Confirmed",
      subtitle: "Your on-chain action succeeded and state is being refreshed.",
      accent: "border-forest-600/40 bg-forest-50",
    },
    reverted: {
      icon: <ShieldAlert className="h-8 w-8 text-rose-700" />,
      title: "Transaction Reverted",
      subtitle: tx.error || "The smart contract rejected this call.",
      accent: "border-rose-300 bg-rose-50",
    },
    rejected: {
      icon: <ShieldAlert className="h-8 w-8 text-slate-600" />,
      title: "Signature Cancelled",
      subtitle: tx.error || "Wallet signature was rejected before broadcasting.",
      accent: "border-slate-300 bg-slate-100",
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
          <h3 className="text-base font-semibold text-slate-900">{stepMeta.title}</h3>
          <p className="mt-1 text-sm text-slate-700">{stepMeta.subtitle}</p>
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
                        ? "bg-rose-600"
                        : "bg-brand-100"
                      : done
                      ? "bg-forest-700"
                      : "bg-brand-100"
                  }`}
                />
                <span className={`block text-[11px] font-medium ${done ? "font-semibold text-forest-800" : "text-slate-600"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {tx.hash && (
          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-xs">
            <span className="text-slate-600">Tx Hash</span>
            <a
              href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono font-semibold text-brand-700 hover:text-brand-900 hover:underline"
            >
              {formatAddress(tx.hash)}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant={tx.phase === "confirmed" ? "forest" : "secondary"} onClick={onClose}>
            {tx.phase === "pending" || tx.phase === "prompt" ? "Hide Window" : "Close"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

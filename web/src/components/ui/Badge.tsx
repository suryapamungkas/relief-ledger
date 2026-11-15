import { motion } from "motion/react";

type BadgeVariant = "fundraising" | "active" | "completed" | "refunding" | "proposed" | "vetoed" | "cancelled" | "executed" | "default";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantConfig: Record<BadgeVariant, { dot: string; bg: string; text: string }> = {
  fundraising: { dot: "bg-blue-400", bg: "bg-blue-900/30 border-blue-700/50", text: "text-blue-300" },
  active: { dot: "bg-emerald-400", bg: "bg-emerald-900/30 border-emerald-700/50", text: "text-emerald-300" },
  completed: { dot: "bg-teal-400", bg: "bg-teal-900/30 border-teal-700/50", text: "text-teal-300" },
  refunding: { dot: "bg-amber-400", bg: "bg-amber-900/30 border-amber-700/50", text: "text-amber-300" },
  proposed: { dot: "bg-purple-400", bg: "bg-purple-900/30 border-purple-700/50", text: "text-purple-300" },
  vetoed: { dot: "bg-red-400", bg: "bg-red-900/30 border-red-700/50", text: "text-red-300" },
  cancelled: { dot: "bg-slate-400", bg: "bg-slate-800/50 border-slate-700/50", text: "text-slate-400" },
  executed: { dot: "bg-green-400", bg: "bg-green-900/30 border-green-700/50", text: "text-green-300" },
  default: { dot: "bg-slate-400", bg: "bg-slate-800/50 border-slate-700/50", text: "text-slate-400" },
};

export function statusToBadgeVariant(status: number): BadgeVariant {
  return (["fundraising", "active", "completed", "refunding"] as BadgeVariant[])[status] ?? "default";
}

export function requestStatusToBadgeVariant(status: number): BadgeVariant {
  return (["default", "proposed", "vetoed", "cancelled", "executed"] as BadgeVariant[])[status] ?? "default";
}

export function Badge({ label, variant = "default", className = "" }: BadgeProps) {
  const cfg = variantConfig[variant];
  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        cfg.bg,
        cfg.text,
        className,
      ].join(" ")}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label}
    </motion.span>
  );
}

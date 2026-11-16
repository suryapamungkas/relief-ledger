import { motion } from "motion/react";

type BadgeVariant = "fundraising" | "active" | "completed" | "refunding" | "proposed" | "vetoed" | "cancelled" | "executed" | "default";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantConfig: Record<BadgeVariant, { dot: string; bg: string; text: string }> = {
  fundraising: { dot: "bg-brand-600", bg: "bg-brand-50 border-brand-300", text: "text-brand-800" },
  active: { dot: "bg-forest-600", bg: "bg-forest-50 border-forest-600/40", text: "text-forest-800 font-semibold" },
  completed: { dot: "bg-forest-700", bg: "bg-forest-100 border-forest-700/45", text: "text-forest-900 font-semibold" },
  refunding: { dot: "bg-amber-600", bg: "bg-amber-50 border-amber-300", text: "text-amber-900" },
  proposed: { dot: "bg-brand-700", bg: "bg-brand-100/80 border-brand-300", text: "text-brand-900" },
  vetoed: { dot: "bg-rose-600", bg: "bg-rose-50 border-rose-300", text: "text-rose-800" },
  cancelled: { dot: "bg-slate-500", bg: "bg-slate-100 border-slate-300", text: "text-slate-700" },
  executed: { dot: "bg-forest-600", bg: "bg-forest-100 border-forest-600/40", text: "text-forest-900 font-semibold" },
  default: { dot: "bg-slate-500", bg: "bg-slate-100 border-slate-300", text: "text-slate-700" },
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

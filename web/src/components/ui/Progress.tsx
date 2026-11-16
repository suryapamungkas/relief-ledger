import { motion } from "motion/react";

interface ProgressProps {
  value: number; // 0-100
  label?: string;
  showPercent?: boolean;
  color?: "brand" | "accent" | "amber";
  className?: string;
}

const colorConfig = {
  brand: "bg-brand-600",
  accent: "bg-forest-700",
  amber: "bg-amber-600",
};

export function Progress({ value, label, showPercent = true, color = "brand", className = "" }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5 text-xs text-slate-600">
          {label && <span>{label}</span>}
          {showPercent && <span className="font-mono font-semibold text-slate-900">{pct.toFixed(1)}%</span>}
        </div>
      )}
      <div className="h-2 bg-brand-100 border border-brand-200/70 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 20, delay: 0.1 }}
          className={`h-full rounded-full ${colorConfig[color]} shadow-xs`}
          style={{
            boxShadow: pct > 0
              ? color === "accent"
                ? "0 0 10px rgba(22, 101, 52, 0.35)"
                : "0 0 10px rgba(2, 132, 199, 0.35)"
              : undefined,
          }}
        />
      </div>
    </div>
  );
}

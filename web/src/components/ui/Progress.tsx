import { motion } from "motion/react";

interface ProgressProps {
  value: number; // 0-100
  label?: string;
  showPercent?: boolean;
  color?: "brand" | "accent" | "amber";
  className?: string;
}

const colorConfig = {
  brand: "bg-brand-500",
  accent: "bg-accent-500",
  amber: "bg-amber-500",
};

export function Progress({ value, label, showPercent = true, color = "brand", className = "" }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5 text-xs text-slate-400">
          {label && <span>{label}</span>}
          {showPercent && <span className="font-mono text-slate-300">{pct.toFixed(1)}%</span>}
        </div>
      )}
      <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 20, delay: 0.1 }}
          className={`h-full rounded-full ${colorConfig[color]} shadow-sm`}
          style={{
            boxShadow: pct > 0
              ? `0 0 10px rgba(13, 148, 136, 0.5)`
              : undefined,
          }}
        />
      </div>
    </div>
  );
}

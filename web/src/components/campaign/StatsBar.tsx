import { motion } from "motion/react";
import { ArrowUpRight, Banknote, Layers, Lock } from "lucide-react";
import { formatUSDC } from "@/lib/format";
import type { ProtocolStats } from "@/hooks/useIndexer";

interface StatsBarProps {
  stats: ProtocolStats;
  loading?: boolean;
}

export function StatsBar({ stats, loading = false }: StatsBarProps) {
  const items = [
    {
      label: "Total Raised",
      value: `${formatUSDC(BigInt(stats.totalRaised || "0"))} USDC`,
      sub: `${stats.totalCampaigns} campaign(s)`,
      icon: Banknote,
      color: "text-brand-700",
      valueColor: "text-slate-900",
      accentBorder: "",
    },
    {
      label: "Disbursed to Vendors",
      value: `${formatUSDC(BigInt(stats.totalDisbursed || "0"))} USDC`,
      sub: "Invoice-backed payouts",
      icon: ArrowUpRight,
      color: "text-forest-700",
      valueColor: "text-forest-800",
      accentBorder: "border-t-4 border-t-forest-700",
    },
    {
      label: "Locked / Escrowed",
      value: `${formatUSDC(BigInt(stats.totalEscrowed || "0"))} USDC`,
      sub: `${formatUSDC(BigInt(stats.totalRefunded || "0"))} refunded`,
      icon: Lock,
      color: "text-brand-600",
      valueColor: "text-slate-900",
      accentBorder: "",
    },
    {
      label: "Campaign States",
      value: `${stats.activeCampaigns} Active`,
      sub: `${stats.completedCampaigns} done · ${stats.refundingCampaigns} refunding`,
      icon: Layers,
      color: "text-forest-700",
      valueColor: "text-slate-900",
      accentBorder: "",
    },
  ];

  return (
    <section aria-label="Protocol metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, idx) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.3, delay: idx * 0.06 }}
          className={`glass glass-hover rounded-2xl p-5 ${item.accentBorder}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {item.label}
            </span>
            <item.icon className={`h-4 w-4 ${item.color}`} aria-hidden="true" />
          </div>
          {loading ? (
            <div className="skeleton mt-3 h-7 w-28 rounded-lg" />
          ) : (
            <p className={`mt-2.5 text-2xl font-bold tracking-tight tabular-nums ${item.valueColor}`}>
              {item.value}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-600 tabular-nums">{item.sub}</p>
        </motion.div>
      ))}
    </section>
  );
}

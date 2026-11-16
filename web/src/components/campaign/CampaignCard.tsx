import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { formatAddress, formatUSDC, progressPercent } from "@/lib/format";
import type { IndexedCampaign } from "@/hooks/useIndexer";

interface CampaignCardProps {
  campaign: IndexedCampaign;
  index?: number;
}

const STATUS_INDEX: Record<string, number> = {
  Fundraising: 0,
  Active: 1,
  Completed: 2,
  Refunding: 3,
};

export function CampaignCard({ campaign, index = 0 }: CampaignCardProps) {
  const raised = BigInt(campaign.raised || "0");
  const goal = BigInt(campaign.minGoal || "1");
  const pct = progressPercent(raised, goal);
  const statusCode = STATUS_INDEX[campaign.status] ?? 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.25) }}
      whileHover={{ y: -4 }}
      className="glass glass-hover flex flex-col justify-between rounded-2xl p-6"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-700">
              Campaign #{campaign.id}
            </span>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              Disaster Relief Operation #{campaign.id}
            </h3>
          </div>
          <Badge label={campaign.status} variant={statusToBadgeVariant(statusCode)} />
        </div>

        <p className="mt-2 truncate font-mono text-xs text-slate-600" title={campaign.metadataCid}>
          Brief CID: {campaign.metadataCid}
        </p>

        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatUSDC(raised)} USDC
            </span>
            <span className="text-xs text-slate-600 tabular-nums">
              Goal: {formatUSDC(goal)} USDC ({pct}%)
            </span>
          </div>
          <Progress
            value={pct}
            color={
              campaign.status === "Refunding"
                ? "amber"
                : campaign.status === "Completed" || campaign.status === "Active"
                ? "accent"
                : "brand"
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs text-slate-700">
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2">
            <span className="block text-[11px] font-medium text-slate-600">Milestones</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {campaign.currentMilestone + 1} / {campaign.milestoneBps.length}
            </span>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2">
            <span className="block text-[11px] font-medium text-slate-600">Verifiers</span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-900 tabular-nums">
              <ShieldCheck className="h-3.5 w-3.5 text-forest-700" aria-hidden="true" />
              {campaign.threshold}/{campaign.verifiers.length}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-4">
        {campaign.status === "Fundraising" ? (
          <CountdownTimer targetTimestamp={campaign.donationDeadline} label="Window" />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <Users className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
            Org: <code className="font-semibold text-slate-800">{formatAddress(campaign.organizer)}</code>
          </span>
        )}

        <Link
          to={`/campaign/${campaign.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-forest-800 bg-forest-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-forest-800"
        >
          Inspect
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </motion.article>
  );
}

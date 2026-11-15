import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowDownRight, ShieldCheck } from "lucide-react";
import { HeroVisual } from "@/components/shared/HeroVisual";
import { StatsBar } from "@/components/campaign/StatsBar";
import { CampaignList } from "@/components/campaign/CampaignList";
import {
  isContractConfigured,
  useCampaignsList,
  useProtocolStats,
} from "@/hooks/useIndexer";

export function Home() {
  const { campaigns, loading } = useCampaignsList();
  const { stats, loading: statsLoading } = useProtocolStats();
  const configured = isContractConfigured();

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="grid items-center gap-8 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-6 lg:col-span-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1 text-xs font-semibold text-brand-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Milestone-Based Disaster Relief Escrow on Sepolia
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Every relief dollar{" "}
            <span className="bg-gradient-to-r from-brand-300 via-accent-400 to-cyan-300 bg-clip-text text-transparent">
              locked until verified
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-slate-300">
            ReliefLedger isolates donor USDC inside immutable campaign escrow contracts.
            Funds disburse exclusively to allowlisted vendors after M-of-N verifier
            sign-off and a public challenge cooldown—never to organizer or admin wallets.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#campaigns-heading"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500"
            >
              Browse Campaigns
              <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-brand-500/40 hover:text-white"
            >
              Read Trust Model
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="lg:col-span-6"
        >
          <HeroVisual />
        </motion.div>
      </section>

      <StatsBar stats={stats} loading={statsLoading} />

      <CampaignList campaigns={campaigns} loading={loading} configured={configured} />
    </div>
  );
}

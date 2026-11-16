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
          <div className="inline-flex items-center gap-2 rounded-full border border-forest-600/30 bg-forest-50 px-3.5 py-1 text-xs font-semibold text-forest-800">
            <ShieldCheck className="h-3.5 w-3.5 text-forest-700" aria-hidden="true" />
            Milestone-Based Disaster Relief Escrow on Sepolia
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Every relief dollar{" "}
            <span className="bg-gradient-to-r from-brand-700 via-forest-700 to-brand-500 bg-clip-text text-transparent">
              locked until verified
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-slate-600">
            ReliefLedger isolates donor USDC inside immutable campaign escrow contracts.
            Funds disburse exclusively to allowlisted vendors after M-of-N verifier
            sign-off and a public challenge cooldown—never to organizer or admin wallets.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#campaigns-heading"
              className="glow-forest inline-flex items-center gap-2 rounded-xl border border-forest-800 bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800"
            >
              Browse Campaigns
              <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-2xs transition hover:border-brand-500 hover:bg-brand-50"
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

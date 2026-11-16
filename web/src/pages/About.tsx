import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Lock, ShieldCheck, Scale } from "lucide-react";

const PROTECTIONS = [
  {
    icon: Lock,
    title: "No Admin Fund Custody",
    text: "Admin can register vendors, create campaigns, and pause new deposits/payouts, but cannot withdraw, sweep, or redirect escrowed USDC.",
  },
  {
    icon: ShieldCheck,
    title: "Verifier Majority + Single-Veto Guard",
    text: "Every disbursement requires >50% verifier quorum plus an immutable 24h–7d challenge window where any single verifier can veto suspicious invoices.",
  },
  {
    icon: Scale,
    title: "Three Automatic Refund Triggers",
    text: "Donors reclaim pro-rata USDC directly from escrow if minimum goal is missed, campaign stalls past timeout (14–90 days), or unspent leftover remains after completion.",
  },
];

export function About() {
  return (
    <div className="space-y-10">
      <div className="max-w-3xl space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-600/30 bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-800">
          Security & Trust Model
        </span>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Built Around Explicit Trust Boundaries
        </h1>
        <p className="text-base text-slate-600">
          On-chain escrow removes platform custody, not off-chain physics. Understanding what code verifies vs. what human committees verify is core to ReliefLedger.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-3">
        {PROTECTIONS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass rounded-2xl p-6 space-y-3"
          >
            <p.icon className="h-6 w-6 text-forest-700" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-slate-900">{p.title}</h2>
            <p className="text-sm leading-relaxed text-slate-600">{p.text}</p>
          </motion.div>
        ))}
      </section>

      <section className="glass rounded-3xl p-6 sm:p-8 space-y-5">
        <h2 className="text-xl font-bold text-slate-900">What Remains Off-Chain (Assumptions & Limitations)</h2>
        <div className="grid gap-4 md:grid-cols-2 text-sm text-slate-700">
          <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 space-y-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
              Collusion & Physical Delivery Reality
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Smart contracts enforce verifier signatures and challenge delays, but if an organizer and quorum of verifiers collude with a compromised vendor, code cannot prove goods physically arrived at a disaster zone. Donors review committee composition before funding.
            </p>
          </div>
          <div className="rounded-2xl border border-forest-600/30 bg-forest-50/60 p-4 space-y-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-forest-700" aria-hidden="true" />
              Out-of-Scope & V2 Roadmap
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              By design, this v1 testnet prototype omits upgradeable proxies, governance tokens, verifier staking/slashing, on-chain KYC, multi-token/ETH deposits, and mainnet deployment. See{" "}
              <code className="rounded bg-white px-1 py-0.5 font-semibold text-slate-800">
                docs/THREAT_MODEL.md
              </code>{" "}
              and{" "}
              <code className="rounded bg-white px-1 py-0.5 font-semibold text-slate-800">
                docs/TRUST_ASSUMPTIONS.md
              </code>{" "}
              for complete documentation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

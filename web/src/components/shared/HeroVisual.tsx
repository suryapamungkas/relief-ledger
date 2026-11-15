import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Clock, Lock, ShieldCheck, Truck, Users } from "lucide-react";

interface FlowNode {
  id: string;
  label: string;
  detail: string;
  badge: string;
  icon: typeof Users;
  cx: number;
  cy: number;
}

const NODES: FlowNode[] = [
  {
    id: "donors",
    label: "1. Escrow Deposit",
    detail: "Donors deposit USDC into campaign-isolated on-chain escrow with a hard deadline and minimum goal.",
    badge: "Pull Refunds if Goal Missed",
    icon: Users,
    cx: 78,
    cy: 76,
  },
  {
    id: "escrow",
    label: "2. Milestone Lock",
    detail: "Funds unlock in strictly capped milestone bps tranches. Admins cannot withdraw or redirect funds.",
    badge: "Zero Admin Custody",
    icon: Lock,
    cx: 230,
    cy: 76,
  },
  {
    id: "verifiers",
    label: "3. Multi-Sig Audit",
    detail: "An independent verifier committee inspects vendor invoices & IPFS hashes before approving payouts.",
    badge: "Strict Majority Threshold",
    icon: ShieldCheck,
    cx: 382,
    cy: 76,
  },
  {
    id: "challenge",
    label: "4. Challenge Window",
    detail: "After threshold approval, a 24h–7d cooldown gives any single verifier power to veto suspicious requests.",
    badge: "Single-Verifier Veto",
    icon: Clock,
    cx: 230,
    cy: 194,
  },
  {
    id: "vendor",
    label: "5. Vendor Settlement",
    detail: "USDC transfers directly to allowlisted suppliers—never to organizer EOAs—before delivery proof unlocks next tranche.",
    badge: "Stall Auto-Refund Guard",
    icon: Truck,
    cx: 382,
    cy: 194,
  },
];

/**
 * Interactive animated architectural visual illustrating ReliefLedger's zero-custody escrow pipeline.
 */
export function HeroVisual() {
  const [selectedId, setSelectedId] = useState<string>("escrow");
  const active = NODES.find((n) => n.id === selectedId) ?? NODES[1]!;

  return (
    <div className="glass glow-brand relative overflow-hidden rounded-3xl p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-300">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Interactive Escrow Architecture
        </span>
        <span className="text-[11px] text-slate-400">Tap any stage to inspect</span>
      </div>

      {/* Animated SVG Graph */}
      <svg
        viewBox="0 0 460 250"
        className="w-full h-auto select-none"
        role="img"
        aria-label="ReliefLedger 5-stage verifiable escrow pipeline"
      >
        <defs>
          <linearGradient id="rlFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {/* Connection paths */}
        <path
          d="M 78 76 L 382 76 L 382 135 L 230 135 L 230 194 L 382 194"
          fill="none"
          stroke="rgba(148,163,184,0.18)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Animated dashed flow */}
        <motion.path
          d="M 78 76 L 382 76 L 382 135 L 230 135 L 230 194 L 382 194"
          fill="none"
          stroke="url(#rlFlowGrad)"
          strokeWidth="3"
          strokeDasharray="10 10"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ strokeDashoffset: [0, -40] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        />

        {/* Refund safety return line */}
        <path
          d="M 205 194 Q 108 196 78 122"
          fill="none"
          stroke="rgba(245,158,11,0.34)"
          strokeWidth="1.75"
          strokeDasharray="4 4"
        />
        <text x="26" y="162" fill="rgba(251,191,36,0.85)" fontSize="9.5" fontWeight="600">
          Refund Guard
        </text>
        <text x="26" y="174" fill="rgba(251,191,36,0.7)" fontSize="8.5" fontWeight="500">
          Missed / Stall / Leftover
        </text>

        {NODES.map((node, index) => {
          const isSelected = node.id === active.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.cx}, ${node.cy})`}
              onClick={() => setSelectedId(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(node.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              aria-label={node.label}
              className="cursor-pointer focus:outline-none"
            >
              {isSelected && (
                <motion.circle
                  r={33}
                  fill="rgba(20, 184, 166, 0.14)"
                  stroke="rgba(45, 212, 191, 0.55)"
                  strokeWidth="1.5"
                  initial={{ scale: 0.85, opacity: 0.6 }}
                  animate={{ scale: [1, 1.12, 1], opacity: [0.85, 0.4, 0.85] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <circle
                r={25}
                fill={isSelected ? "#0f766e" : "#0f172a"}
                stroke={isSelected ? "#2dd4bf" : "#334155"}
                strokeWidth={isSelected ? 2 : 1.5}
              />
              <text
                y="4"
                textAnchor="middle"
                fill={isSelected ? "#ffffff" : "#94a3b8"}
                fontSize="12"
                fontWeight="700"
              >
                0{index + 1}
              </text>
              <text
                y="41"
                textAnchor="middle"
                fill={isSelected ? "#5eead4" : "#cbd5e1"}
                fontSize="10.5"
                fontWeight="600"
              >
                {node.label.replace(/^\d+\.\s*/, "")}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Interactive stage detail panel */}
      <motion.div
        key={active.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="mt-3 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <active.icon className="h-4 w-4 text-brand-400" aria-hidden="true" />
            <span>{active.label}</span>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            {active.badge}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{active.detail}</p>
      </motion.div>
    </div>
  );
}

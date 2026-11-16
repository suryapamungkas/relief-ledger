import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, ShieldOff } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { CampaignCard } from "./CampaignCard";
import type { IndexedCampaign } from "@/hooks/useIndexer";

interface CampaignListProps {
  campaigns: IndexedCampaign[];
  loading: boolean;
  configured: boolean;
}

export function CampaignList({ campaigns, loading, configured }: CampaignListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      All: campaigns.length,
      Fundraising: 0,
      Active: 0,
      Completed: 0,
      Refunding: 0,
    };
    for (const c of campaigns) {
      map[c.status] = (map[c.status] ?? 0) + 1;
    }
    return map;
  }, [campaigns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(c.id).includes(q) ||
        c.organizer.toLowerCase().includes(q) ||
        c.metadataCid.toLowerCase().includes(q)
      );
    });
  }, [campaigns, statusFilter, search]);

  const tabs = [
    { id: "All", label: "All", count: counts.All },
    { id: "Fundraising", label: "Fundraising", count: counts.Fundraising },
    { id: "Active", label: "Active", count: counts.Active },
    { id: "Completed", label: "Completed", count: counts.Completed },
    { id: "Refunding", label: "Refunding", count: counts.Refunding },
  ];

  return (
    <section aria-labelledby="campaigns-heading" className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="campaigns-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            Relief Campaigns
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Every campaign enforces milestone caps, verifier majority sign-off, and verifiable delivery proof.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <label htmlFor="campaign-search" className="visually-hidden">
            Search campaigns by ID, organizer address, or metadata CID
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-700"
            aria-hidden="true"
          />
          <input
            id="campaign-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, address, CID…"
            className="w-full rounded-xl border border-brand-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-brand-600 focus:outline-none"
          />
        </div>
      </div>

      <Tabs
        tabs={tabs}
        activeId={statusFilter}
        onChange={setStatusFilter}
        ariaLabel="Filter campaigns by status"
        layoutId="campaign-status-tabs"
      />

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-10 text-center"
        >
          <ShieldOff className="mx-auto h-10 w-10 text-brand-700" aria-hidden="true" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            {!configured
              ? "Sepolia Contract Address Not Configured"
              : "No campaigns match your current filter"}
          </h3>
          <p className="mx-auto mt-1.5 max-w-lg text-sm text-slate-600">
            {!configured
              ? "Set VITE_RELIEF_LEDGER_ADDRESS and VITE_MOCK_USDC_ADDRESS in web/.env (or run scripts/Deploy.s.sol + SeedDemo.s.sol on Sepolia) to connect live escrow campaigns."
              : "Try selecting the All status tab or clearing your search query."}
          </p>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c, idx) => (
              <CampaignCard key={c.id} campaign={c} index={idx} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </section>
  );
}

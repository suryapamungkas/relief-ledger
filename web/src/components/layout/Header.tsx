import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { Menu, PauseCircle, ShieldCheck, X } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { useOwner, usePaused } from "@/hooks/useReliefLedger";
import { SEPOLIA_CHAIN_ID } from "@/config/contracts";

interface NavItem {
  to: string;
  label: string;
}

const BASE_NAV: NavItem[] = [
  { to: "/", label: "Campaigns" },
  { to: "/me", label: "My Donations" },
  { to: "/organizer", label: "Organizer" },
  { to: "/verifier", label: "Verifier" },
  { to: "/about", label: "Trust Model" },
];

export function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: ownerAddr } = useOwner();
  const { data: isPaused } = usePaused();

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 32,
    restDelta: 0.001,
  });

  const isOwner =
    Boolean(address && ownerAddr) &&
    address!.toLowerCase() === (ownerAddr as string).toLowerCase();

  const navItems: NavItem[] = isOwner
    ? [...BASE_NAV, { to: "/admin", label: "Admin" }]
    : BASE_NAV;

  const wrongNetwork = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  return (
    <header className="sticky top-0 z-40 border-b border-brand-200/80 bg-white/88 backdrop-blur-xl shadow-xs">
      {/* Scroll Progress Indicator */}
      <motion.div
        style={{ scaleX, transformOrigin: "0% 50%" }}
        className="h-0.5 w-full bg-gradient-to-r from-brand-500 via-forest-700 to-brand-400"
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="group inline-flex items-center gap-2.5 rounded-xl py-1 pr-2 text-slate-900 transition hover:opacity-90"
        >
          <img
            src="/logo.svg"
            alt=""
            className="h-8 w-8 rounded-lg shadow-xs"
            width={32}
            height={32}
          />
          <div className="leading-tight">
            <span className="block text-base font-bold tracking-tight text-slate-900">
              Relief<span className="text-brand-700">Ledger</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-brand-700">
              Sepolia Escrow
            </span>
          </div>
        </Link>

        {/* Primary desktop nav */}
        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/" || location.pathname.startsWith("/campaign/")
                : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                  active ? "font-semibold text-brand-950" : "text-slate-600 hover:text-brand-700"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="header-nav-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-xl border border-brand-300 bg-brand-100/80"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          {Boolean(isPaused) && (
            <span className="hidden items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 sm:inline-flex">
              <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Paused
            </span>
          )}

          {wrongNetwork && (
            <span className="hidden items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 lg:inline-flex">
              Wrong Network
            </span>
          )}

          <div className="hidden sm:block">
            <ConnectButton chainStatus="icon" showBalance={false} />
          </div>

          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-900 md:hidden cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Responsive mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            id="mobile-nav-drawer"
            aria-label="Mobile navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-brand-200/80 bg-white/95 px-4 md:hidden"
          >
            <div className="flex flex-col gap-1.5 py-4">
              {navItems.map((item) => {
                const active =
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium ${
                      active
                        ? "border border-brand-300 bg-brand-100/80 font-semibold text-brand-950"
                        : "text-slate-700 hover:bg-brand-50"
                    }`}
                  >
                    <span>{item.label}</span>
                    {active && <ShieldCheck className="h-4 w-4 text-forest-700" />}
                  </Link>
                );
              })}

              <div className="pt-2 sm:hidden">
                <ConnectButton chainStatus="full" showBalance={false} />
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

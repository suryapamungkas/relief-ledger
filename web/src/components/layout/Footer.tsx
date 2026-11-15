import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { formatAddress } from "@/lib/format";

export function Footer() {
  const configured =
    CONTRACT_ADDRESSES.RELIEF_LEDGER !== "0x0000000000000000000000000000000000000000";

  return (
    <footer className="mt-16 border-t border-slate-800/70 bg-slate-950/70 py-10 text-sm text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-slate-200">
            <Shield className="h-4 w-4 text-brand-400" aria-hidden="true" />
            <span>ReliefLedger — Milestone-Escrow Disaster Relief</span>
          </div>
          <p className="text-xs text-slate-500">
            Sepolia testnet prototype. Contracts unaudited. Do not send real value.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <Link to="/" className="hover:text-brand-300">
            Campaigns
          </Link>
          <Link to="/me" className="hover:text-brand-300">
            My Donations
          </Link>
          <Link to="/about" className="hover:text-brand-300">
            Trust Assumptions
          </Link>
          <span className="font-mono text-slate-500">
            Contract:{" "}
            {configured ? (
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESSES.RELIEF_LEDGER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 hover:underline"
              >
                {formatAddress(CONTRACT_ADDRESSES.RELIEF_LEDGER)}
              </a>
            ) : (
              "Pending deploy config"
            )}
          </span>
        </div>
      </div>
    </footer>
  );
}

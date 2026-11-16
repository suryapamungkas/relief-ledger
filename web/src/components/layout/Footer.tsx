import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { formatAddress } from "@/lib/format";

export function Footer() {
  const configured =
    CONTRACT_ADDRESSES.RELIEF_LEDGER !== "0x0000000000000000000000000000000000000000";

  return (
    <footer className="mt-16 border-t border-brand-200/80 bg-white/85 py-10 text-sm text-slate-600">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Shield className="h-4 w-4 text-forest-700" aria-hidden="true" />
            <span>ReliefLedger — Milestone-Escrow Disaster Relief</span>
          </div>
          <p className="text-xs text-slate-600">
            Sepolia testnet prototype. Contracts unaudited. Do not send real value.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <Link to="/" className="font-medium text-slate-700 hover:text-brand-700">
            Campaigns
          </Link>
          <Link to="/me" className="font-medium text-slate-700 hover:text-brand-700">
            My Donations
          </Link>
          <Link to="/about" className="font-medium text-slate-700 hover:text-brand-700">
            Trust Assumptions
          </Link>
          <span className="font-mono text-slate-600">
            Contract:{" "}
            {configured ? (
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESSES.RELIEF_LEDGER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-700 hover:underline"
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

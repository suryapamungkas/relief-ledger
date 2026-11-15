import { AlertTriangle } from "lucide-react";

/**
 * Persistent Sepolia testnet prototype warning rendered on every page (SPEC §0 & §9.1).
 */
export function DisclaimerBanner() {
  return (
    <div
      role="status"
      aria-label="Testnet disclaimer"
      className="border-b border-amber-500/25 bg-amber-950/50 px-4 py-2 text-center text-xs font-medium text-amber-200 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-amber-100">
            Testnet prototype. Not audited. No real funds.
          </strong>{" "}
          Running on Ethereum Sepolia with MockUSDC test tokens.
        </span>
      </div>
    </div>
  );
}

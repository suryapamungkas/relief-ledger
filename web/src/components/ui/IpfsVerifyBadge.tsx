import { useState } from "react";
import { Check, ExternalLink, FileCheck2, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { computeCidHash, formatAddress, safeIpfsGatewayUrl } from "@/lib/format";

interface IpfsVerifyBadgeProps {
  cid: string;
  expectedHash?: string | null;
  label?: string;
}

/**
 * Displays sanitized IPFS gateway link and lets anyone verify keccak256(cid) === on-chain hash.
 */
export function IpfsVerifyBadge({
  cid,
  expectedHash,
  label = "Evidence CID",
}: IpfsVerifyBadgeProps) {
  const [checked, setChecked] = useState(false);
  const url = safeIpfsGatewayUrl(cid);
  const computed = cid ? computeCidHash(cid) : null;
  const matches =
    Boolean(computed && expectedHash) &&
    computed!.toLowerCase() === expectedHash!.toLowerCase();

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-600">{label}</span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono font-semibold text-brand-700 hover:text-brand-900 hover:underline"
          >
            {cid.length > 30 ? `${cid.slice(0, 18)}…${cid.slice(-8)}` : cid}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="font-mono font-medium text-rose-700">Invalid or unsafe CID</span>
        )}
      </div>

      {expectedHash && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-brand-200/80 pt-2">
          <span className="font-mono text-[11px] text-slate-600">
            Hash: {formatAddress(expectedHash)}
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setChecked(true)}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 font-semibold transition cursor-pointer ${
              checked
                ? matches
                  ? "border border-forest-800 bg-forest-700 text-white shadow-2xs"
                  : "border border-rose-800 bg-rose-700 text-white"
                : "border border-brand-300 bg-white text-brand-800 hover:bg-brand-100"
            }`}
          >
            {checked ? (
              matches ? (
                <>
                  <Check className="h-3 w-3" aria-hidden="true" />
                  keccak256 Verified
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  Hash Mismatch
                </>
              )
            ) : (
              <>
                <FileCheck2 className="h-3 w-3" aria-hidden="true" />
                Verify Hash
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}

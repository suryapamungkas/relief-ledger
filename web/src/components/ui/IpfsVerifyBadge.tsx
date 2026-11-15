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
    <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-400">{label}</span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-brand-300 hover:text-brand-200"
          >
            {cid.length > 30 ? `${cid.slice(0, 18)}…${cid.slice(-8)}` : cid}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="font-mono text-rose-400">Invalid or unsafe CID</span>
        )}
      </div>

      {expectedHash && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2">
          <span className="font-mono text-[11px] text-slate-500">
            Hash: {formatAddress(expectedHash)}
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setChecked(true)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition cursor-pointer ${
              checked
                ? matches
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-rose-500/15 text-rose-300"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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

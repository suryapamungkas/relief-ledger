import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatCountdown } from "@/lib/format";

interface CountdownTimerProps {
  targetTimestamp: number; // unix seconds
  label: string;
  elapsedText?: string;
}

/**
 * Live 1-second countdown timer using tabular numerals and urgency visual cue.
 */
export function CountdownTimer({
  targetTimestamp,
  label,
  elapsedText = "Ready / Elapsed",
}: CountdownTimerProps) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = targetTimestamp > 0 ? targetTimestamp - nowSec : 0;
  const elapsed = remaining <= 0;
  const urgent = !elapsed && remaining < 3600;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium tabular-nums ${
        elapsed
          ? "border-forest-600/40 bg-forest-50 text-forest-800"
          : urgent
          ? "border-amber-400 bg-amber-50 text-amber-900"
          : "border-brand-200 bg-brand-50 text-brand-900"
      }`}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className={elapsed ? "text-forest-800" : urgent ? "text-amber-900" : "text-brand-800"}>
        {label}:
      </span>
      <span className={`font-semibold ${elapsed ? "text-forest-900" : "text-slate-900"}`}>
        {elapsed ? elapsedText : formatCountdown(remaining)}
      </span>
    </div>
  );
}

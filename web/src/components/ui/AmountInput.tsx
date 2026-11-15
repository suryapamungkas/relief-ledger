import { useId } from "react";
import { AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface AmountInputProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
  quickAmounts?: string[];
  onMaxClick?: () => void;
  maxLabel?: string;
}

/**
 * Accessible USDC 6-decimal input with hint positioned above field and polite error announcement.
 */
export function AmountInput({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder = "100.00",
  disabled = false,
  quickAmounts = ["10", "50", "100", "500"],
  onMaxClick,
  maxLabel = "Max",
}: AmountInputProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-200">
          {label}
        </label>
        {onMaxClick && (
          <button
            type="button"
            disabled={disabled}
            onClick={onMaxClick}
            className="text-xs font-medium text-brand-400 transition hover:text-brand-300 disabled:opacity-50 cursor-pointer"
          >
            {maxLabel}
          </button>
        )}
      </div>

      {hint && (
        <p id={hintId} className="text-xs text-slate-400">
          {hint}
        </p>
      )}

      <div className="relative flex items-center">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          pattern="^\d+(\.\d{1,6})?$"
          disabled={disabled}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || /^\d*\.?\d{0,6}$/.test(raw)) {
              onChange(raw);
            }
          }}
          placeholder={placeholder}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={[hint ? hintId : "", hasError ? errorId : ""].filter(Boolean).join(" ") || undefined}
          className="rl-input w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 pr-16 text-base font-medium text-white placeholder:text-slate-500 tabular-nums focus:outline-none disabled:opacity-50"
        />
        <span
          className="pointer-events-none absolute right-3 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-brand-300"
          aria-hidden="true"
        >
          USDC
        </span>
      </div>

      {quickAmounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {quickAmounts.map((preset) => (
            <motion.button
              key={preset}
              type="button"
              disabled={disabled}
              whileTap={{ scale: 0.94 }}
              onClick={() => onChange(preset)}
              className={`min-h-7 rounded-lg border px-2.5 py-1 text-xs font-medium tabular-nums transition cursor-pointer ${
                value === preset
                  ? "border-brand-400/60 bg-brand-500/20 text-brand-200"
                  : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              ${preset}
            </motion.button>
          ))}
        </div>
      )}

      <div aria-live="polite" className="min-h-5">
        {hasError && (
          <p id={errorId} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-rose-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}

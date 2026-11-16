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
        <label htmlFor={inputId} className="text-sm font-semibold text-slate-800">
          {label}
        </label>
        {onMaxClick && (
          <button
            type="button"
            disabled={disabled}
            onClick={onMaxClick}
            className="text-xs font-semibold text-forest-700 transition hover:text-forest-800 disabled:opacity-50 cursor-pointer"
          >
            {maxLabel}
          </button>
        )}
      </div>

      {hint && (
        <p id={hintId} className="text-xs text-slate-600">
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
          className="rl-input w-full rounded-xl border border-brand-300 bg-white px-4 py-2.5 pr-16 text-base font-medium text-slate-900 placeholder:text-slate-500 tabular-nums focus:border-brand-600 focus:outline-none disabled:opacity-50"
        />
        <span
          className="pointer-events-none absolute right-3 rounded-md border border-brand-200 bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800"
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
              className={`min-h-7 rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition cursor-pointer ${
                value === preset
                  ? "border-forest-800 bg-forest-700 text-white shadow-2xs"
                  : "border-brand-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-900"
              }`}
            >
              ${preset}
            </motion.button>
          ))}
        </div>
      )}

      <div aria-live="polite" className="min-h-5">
        {hasError && (
          <p id={errorId} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-rose-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}

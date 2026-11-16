import { useId, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  layoutId?: string;
}

/**
 * WAI-ARIA Tabs with arrow-key navigation and Motion shared-layout indicator.
 */
export function Tabs({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  layoutId = "tabs-indicator",
}: TabsProps) {
  const baseId = useId();

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = tabs.findIndex((t) => t.id === activeId);
    if (idx < 0) return;

    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    else return;

    e.preventDefault();
    const target = tabs[nextIdx];
    if (target) {
      onChange(target.id);
      document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="inline-flex flex-wrap gap-1 rounded-xl border border-brand-200 bg-brand-50/90 p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            id={`${baseId}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`relative inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              selected
                ? "font-semibold text-brand-950"
                : "text-slate-600 hover:text-brand-800"
            }`}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-lg border border-brand-200 border-b-2 border-b-forest-700 bg-white shadow-xs"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    selected
                      ? "bg-forest-700 text-white"
                      : "bg-brand-100 text-brand-800"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

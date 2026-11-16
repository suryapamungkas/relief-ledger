import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  closeLabel?: string;
}

/**
 * Accessible native <dialog> top-layer modal.
 * Uses showModal() + ::backdrop + @starting-style transitions in index.css.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  closeLabel = "Close dialog",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.classList.remove("is-closing");
      dialog.showModal();
    } else if (!open && dialog.open) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        dialog.close();
        return;
      }
      dialog.classList.add("is-closing");
      const finish = () => {
        dialog.classList.remove("is-closing");
        if (dialog.open) dialog.close();
      };
      const timer = window.setTimeout(finish, 240);
      const onEnd = (e: TransitionEvent) => {
        if (e.target === dialog) {
          window.clearTimeout(timer);
          dialog.removeEventListener("transitionend", onEnd);
          finish();
        }
      };
      dialog.addEventListener("transitionend", onEnd);
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="rl-dialog-title"
      aria-describedby={description ? "rl-dialog-desc" : undefined}
      className="rl-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 border-b border-brand-100 pb-4">
          <div>
            <h2 id="rl-dialog-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p id="rl-dialog-desc" className="mt-1 text-sm text-slate-600">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-slate-700 transition hover:border-brand-400 hover:bg-brand-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="pt-4">{children}</div>
      </div>
    </dialog>
  );
}

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  className?: string;
  fullWidth?: boolean;
}

const variantStyles = {
  primary:
    "bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/40",
  secondary:
    "bg-surface-100 hover:bg-surface-200 text-slate-200 border border-slate-700/50",
  danger:
    "bg-red-900/60 hover:bg-red-800/80 text-red-200 border border-red-700/50",
  ghost:
    "bg-transparent hover:bg-surface-100 text-slate-300 border border-transparent hover:border-slate-700/50",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  children,
  onClick,
  disabled,
  loading,
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      whileHover={isDisabled ? {} : { scale: 1.02 }}
      whileTap={isDisabled ? {} : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={[
        "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium",
        "transition-colors duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0",
        variantStyles[variant],
        sizeStyles[size],
        isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading && (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
        />
      )}
      {children}
    </motion.button>
  );
}

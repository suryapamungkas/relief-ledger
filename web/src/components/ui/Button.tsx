import { motion } from "motion/react";
import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "forest" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  className?: string;
  fullWidth?: boolean;
}

const variantStyles = {
  primary:
    "bg-brand-700 hover:bg-brand-800 text-white shadow-md shadow-brand-700/20 border border-brand-800",
  forest:
    "bg-forest-700 hover:bg-forest-800 text-white shadow-md shadow-forest-800/25 border border-forest-800",
  secondary:
    "bg-white hover:bg-brand-50 text-brand-900 border border-brand-300 shadow-2xs",
  danger:
    "bg-rose-700 hover:bg-rose-800 text-white border border-rose-800 shadow-xs",
  ghost:
    "bg-transparent hover:bg-brand-100/70 text-slate-700 border border-transparent hover:border-brand-200",
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
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

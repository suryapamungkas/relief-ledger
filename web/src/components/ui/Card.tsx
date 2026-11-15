import { motion } from "motion/react";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  glow?: boolean;
}

export function Card({ children, className = "", hover = false, onClick, glow = false }: CardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -4, scale: 1.005 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={[
        "glass rounded-2xl p-6",
        hover ? "glass-hover cursor-pointer" : "",
        glow ? "glow-sm" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </motion.div>
  );
}

import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import { useLocation } from "react-router-dom";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col mesh-gradient bg-brand-50 text-slate-900">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <DisclaimerBanner />
        <Header />

        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>

        <Footer />
      </div>
    </MotionConfig>
  );
}

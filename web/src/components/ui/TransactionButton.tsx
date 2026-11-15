import type { ReactNode } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "./Button";
import { SEPOLIA_CHAIN_ID } from "@/config/contracts";

interface TransactionButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
}

/**
 * Network-aware & wallet-aware transaction trigger.
 * Automatically prompts Sepolia network switch when user is on an unsupported chain.
 */
export function TransactionButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: TransactionButtonProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (!isConnected) {
    return (
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <Button
            type="button"
            variant="secondary"
            size={size}
            fullWidth={fullWidth}
            onClick={openConnectModal}
            className={className}
          >
            Connect Wallet to Continue
          </Button>
        )}
      </ConnectButton.Custom>
    );
  }

  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <Button
        type="button"
        variant="secondary"
        size={size}
        fullWidth={fullWidth}
        loading={isSwitching}
        onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
        className={`border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 ${className}`}
      >
        <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        Switch Network to Sepolia
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      className={className}
    >
      {children}
    </Button>
  );
}

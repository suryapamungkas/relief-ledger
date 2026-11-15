import { http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const projectId = import.meta.env["VITE_WALLETCONNECT_PROJECT_ID"] ?? "placeholder-project-id";

export const wagmiConfig = getDefaultConfig({
  appName: "ReliefLedger",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});

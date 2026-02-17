// wagmi + rainbowkit config for pizzapoap admin dashboard
// monad testnet is a custom chain not built into viem/wagmi yet,
// so we define it manually here using the same rpc + chain id as the backend

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

// monad testnet chain definition
// chain id 10143, same as hardhat.config.ts
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "MON",
    symbol: "MON",
  },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

// rainbowkit / wagmi project config
// walletconnect project id is required by rainbowkit even for injected wallets
// get one free at cloud.walletconnect.com
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "pizzapoap-dev";

export const wagmiConfig = getDefaultConfig({
  appName: "Pizza Call Token Admin",
  projectId: walletConnectProjectId,
  chains: [monadTestnet],
  ssr: true, // next.js app router needs ssr: true
});

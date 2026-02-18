// wagmi + rainbowkit config for pizza call token admin dashboard
// uses getDefaultConfig which wires rainbowkit and wagmi together correctly
// requires a real walletconnect project id (free at cloud.walletconnect.com)

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { http, fallback } from "wagmi";

// monad testnet chain definition
// chain id 10143, same as hardhat.config.ts
// multiple rpc fallbacks -- the official rpc is often congested/rate-limited
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "MON",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: [
        "https://monad-testnet.drpc.org",      // drpc (reliable)
        "https://testnet-rpc.monad.xyz",        // official (congested)
        "https://rpc.ankr.com/monad_testnet",   // ankr fallback
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

// set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in frontend/.env.local
// free project id from cloud.walletconnect.com -- required for rainbowkit modal
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error(
    "missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in frontend/.env.local\nget a free id at https://cloud.walletconnect.com"
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "Pizza Call Token Admin",
  projectId,
  chains: [monadTestnet],
  // ssr: false (default) -- the mounted guard in page.tsx already prevents
  // hydration mismatches, so we don't need wagmi's ssr mode which can
  // interfere with custom transports
  transports: {
    [monadTestnet.id]: fallback([
      http("https://monad-testnet.drpc.org"),     // drpc (most reliable)
      http("https://testnet-rpc.monad.xyz"),       // official
      http("https://rpc.ankr.com/monad_testnet"),  // ankr
    ]),
  },
});

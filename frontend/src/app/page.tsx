"use client";

// main admin dashboard page
// shows connect wallet prompt -> owner check -> dashboard sections

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, usePublicClient, useReadContract } from "wagmi";
import { PIZZA_POAP_ABI, PIZZA_POAP_ADDRESS } from "@/lib/contract";
import { monadTestnet } from "@/lib/wagmi";
import { CreateEventForm } from "@/components/CreateEventForm";
import { EventList } from "@/components/EventList";

export default function Home() {
  // mounted guard: server has no wallet state, client does.
  // without this, react throws a hydration mismatch error on first load.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // refreshKey increments each time a new event is created
  const [refreshKey, setRefreshKey] = useState(0);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // read the contract owner directly via the public client (viem under the hood)
  // using usePublicClient + useEffect avoids react-query cache issues
  const publicClient = usePublicClient();
  const [ownerAddress, setOwnerAddress] = useState<string | undefined>();
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState(false);

  useEffect(() => {
    if (!mounted || !isConnected || !publicClient) return;
    setOwnerLoading(true);
    setOwnerError(false);
    publicClient
      .readContract({
        address: PIZZA_POAP_ADDRESS,
        abi: PIZZA_POAP_ABI,
        functionName: "owner",
      })
      .then((owner) => {
        setOwnerAddress(owner as string);
        setOwnerLoading(false);
      })
      .catch((err) => {
        console.error("owner() read failed:", err.message);
        setOwnerError(true);
        setOwnerLoading(false);
      });
  }, [mounted, isConnected, publicClient]);

  // check if the connected wallet is the contract owner
  const isOwner =
    isConnected &&
    !!ownerAddress &&
    address?.toLowerCase() === ownerAddress.toLowerCase();

  // true while we're waiting for the owner read to come back after connecting
  const isCheckingOwner = isConnected && ownerLoading;

  // detect the actual problem when the contract read fails
  const onMonadTestnet = chainId === monadTestnet.id; // chain id 10143
  const contractReadFailed = isConnected && !ownerLoading && (ownerError || !ownerAddress);

  // wrong network = connected but NOT on monad testnet
  const isWrongNetwork = contractReadFailed && !onMonadTestnet;
  // rpc error = connected AND on monad testnet but contract still can't be read
  const isRpcError = contractReadFailed && onMonadTestnet;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* header */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          {/* logo + title */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍕</span>
            <div>
              <h1 className="text-lg font-bold leading-none text-white">
                Pizza Call Token
              </h1>
              <p className="text-xs text-zinc-500">Admin Dashboard</p>
            </div>
          </div>

          {/* wallet connect button from rainbowkit */}
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </header>

      {/* main content area */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* show nothing until we've mounted in the browser --
            prevents server/client hydration mismatch on wallet state */}
        {!mounted && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
          </div>
        )}

        {/* disconnected state -- prompt to connect */}
        {mounted && !isConnected && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 py-20 text-center">
            <span className="text-5xl">🍕</span>
            <h2 className="text-xl font-semibold text-white">
              Connect your wallet to continue
            </h2>
            <p className="max-w-sm text-sm text-zinc-400">
              This dashboard is for the PizzaDAO admin wallet only. Connect to
              create events and manage attendance tokens.
            </p>
            <div className="mt-2">
              <ConnectButton />
            </div>
          </div>
        )}

        {/* loading state -- wallet connected but still reading owner from chain */}
        {mounted && isCheckingOwner && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
            <p className="text-sm text-zinc-500">Verifying wallet...</p>
          </div>
        )}

        {/* wrong network -- wallet is not on monad testnet at all */}
        {mounted && isWrongNetwork && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-yellow-900 bg-yellow-950/20 py-20 text-center">
            <span className="text-5xl">⛓️</span>
            <h2 className="text-xl font-semibold text-white">
              Switch to Monad Testnet
            </h2>
            <p className="max-w-sm text-sm text-zinc-400">
              Your wallet is on chain ID{" "}
              <span className="font-mono text-yellow-400">{chainId}</span>. Switch to{" "}
              <span className="font-medium text-yellow-400">Monad Testnet</span>{" "}
              (chain ID 10143) to continue.
            </p>
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-left font-mono text-xs text-zinc-400">
              <p>Network: Monad Testnet</p>
              <p>Chain ID: 10143</p>
              <p>RPC: https://monad-testnet.drpc.org</p>
            </div>
          </div>
        )}

        {/* rpc error -- on monad testnet but can't reach the contract */}
        {mounted && isRpcError && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-orange-900 bg-orange-950/20 py-20 text-center">
            <span className="text-5xl">📡</span>
            <h2 className="text-xl font-semibold text-white">
              RPC connection issue
            </h2>
            <p className="max-w-sm text-sm text-zinc-400">
              You&apos;re on Monad Testnet but the app can&apos;t reach the contract.
              The RPC might be rate-limited or down.
            </p>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-500">Try these fixes in order:</p>
              <ol className="text-left text-sm text-zinc-400 space-y-1 list-decimal list-inside">
                <li>Hard refresh the page (Ctrl+Shift+R)</li>
                <li>
                  Update MetaMask RPC to{" "}
                  <span className="font-mono text-orange-400">https://monad-testnet.drpc.org</span>
                </li>
                <li>Wait 30 seconds and try again</li>
              </ol>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition"
            >
              Refresh page
            </button>
          </div>
        )}

        {/* connected but not the owner */}
        {mounted && isConnected && !ownerLoading && ownerAddress && !isOwner && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-900 bg-red-950/30 py-20 text-center">
            <span className="text-5xl">🚫</span>
            <h2 className="text-xl font-semibold text-white">
              Wrong wallet
            </h2>
            <p className="max-w-sm text-sm text-zinc-400">
              This wallet is not the contract owner. Connect the admin wallet
              that deployed the contract.
            </p>
            <p className="mt-1 rounded-md bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-500">
              owner: {ownerAddress}
            </p>
          </div>
        )}

        {/* connected and is owner -- show the dashboard */}
        {mounted && isConnected && !ownerLoading && isOwner && (
          <div className="flex flex-col gap-8">
            {/* stats bar */}
            <StatsBar />

            {/* create event form */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-1 text-base font-semibold text-white">
                Create New Event
              </h2>
              <p className="mb-5 text-sm text-zinc-500">
                Creates a new on-chain event that tokens can be minted for.
              </p>
              <CreateEventForm onEventCreated={() => setRefreshKey((k) => k + 1)} />
            </div>

            {/* past events list */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-1 text-base font-semibold text-white">
                Past Events
              </h2>
              <p className="mb-5 text-sm text-zinc-500">
                Toggle minting on or off for any event.
              </p>
              <EventList refreshKey={refreshKey} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// small stats bar showing total events + tokens minted across all events
function StatsBar() {
  const { data: totalEventsRaw } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "totalEvents",
  });
  const totalEvents = totalEventsRaw as bigint | undefined;

  const { data: totalSupplyRaw } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "totalSupply",
  });
  const totalSupply = totalSupplyRaw as bigint | undefined;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
      <StatCard
        label="Total Events"
        value={totalEvents !== undefined ? totalEvents.toString() : "—"}
      />
      <StatCard
        label="Tokens Minted"
        value={totalSupply !== undefined ? totalSupply.toString() : "—"}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

"use client";

// main admin dashboard page
// shows connect wallet prompt -> owner check -> dashboard sections

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { PIZZA_POAP_ABI, PIZZA_POAP_ADDRESS } from "@/lib/contract";
import { CreateEventForm } from "@/components/CreateEventForm";
import { EventList } from "@/components/EventList";

export default function Home() {
  // refreshKey increments each time a new event is created,
  // which tells EventList to re-read the total event count from the contract
  const [refreshKey, setRefreshKey] = useState(0);
  const { address, isConnected } = useAccount();

  // read the contract owner -- used to guard admin actions
  const { data: ownerRaw, isLoading: ownerLoading } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "owner",
    // only fetch once a wallet is connected -- no point reading otherwise
    query: { enabled: isConnected },
  });
  const ownerAddress = ownerRaw as string | undefined;

  // check if the connected wallet is the contract owner
  const isOwner =
    isConnected &&
    !!ownerAddress &&
    address?.toLowerCase() === ownerAddress.toLowerCase();

  // true while we're waiting for the owner read to come back after connecting
  const isCheckingOwner = isConnected && ownerLoading;

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
        {/* disconnected state -- prompt to connect */}
        {!isConnected && (
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
        {isCheckingOwner && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
            <p className="text-sm text-zinc-500">Verifying wallet...</p>
          </div>
        )}

        {/* connected but not the owner */}
        {isConnected && !ownerLoading && ownerAddress && !isOwner && (
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
        {isConnected && !ownerLoading && isOwner && (
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

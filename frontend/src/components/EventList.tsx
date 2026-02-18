"use client";

// shows all past events read directly from the contract
// each card has: artwork, name, date, mint count, and an active/inactive toggle

import { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import toast from "react-hot-toast";
import { PIZZA_POAP_ABI, PIZZA_POAP_ADDRESS } from "@/lib/contract";
import { ipfsToHttp } from "@/lib/pinata";

type EventData = {
  name: string;
  description: string;
  imageURI: string;
  eventDate: bigint;
  mintCount: bigint;
  active: boolean;
};

export function EventList({ refreshKey }: { refreshKey: number }) {
  // read total events -- no scopeKey so wagmi uses the shared cache
  // (scopeKey was creating a separate stale query per refreshKey value)
  const { data: totalRaw, refetch } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "totalEvents",
  });

  // when refreshKey increments (after a send), explicitly ask wagmi to re-read
  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  const total = totalRaw ? Number(totalRaw as bigint) : 0;

  // show skeletons while the initial query is in flight
  if (totalRaw === undefined) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-800/60" />
        ))}
      </div>
    );
  }

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        No events yet. Send tokens for a call above to get started.
      </p>
    );
  }

  // render newest-first (highest id first)
  const ids = Array.from({ length: total }, (_, i) => total - 1 - i);

  return (
    <div className="flex flex-col gap-4">
      {ids.map((id) => (
        <EventCard key={id} eventId={id} />
      ))}
    </div>
  );
}

function EventCard({ eventId }: { eventId: number }) {
  const [toggling, setToggling] = useState(false);

  const { data: rawEvent, refetch, isError, error, isLoading } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "events",
    args: [BigInt(eventId)],
    // retry up to 3 times with a 2s delay -- handles rpc rate limits
    query: { retry: 3, retryDelay: 2000 },
  });

  const { writeContract, data: txHash } = useWriteContract();

  const { isSuccess: toggleConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  if (toggleConfirmed && toggling) {
    toast.dismiss("toggle-pending");
    toast.success("Event updated ✓");
    setToggling(false);
    refetch();
  }

  // show the actual rpc error so we can debug it
  if (isError) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3">
        <p className="text-xs text-red-400">
          event #{eventId} failed to load: {error?.message?.slice(0, 80)}
        </p>
        <button
          onClick={() => refetch()}
          className="ml-3 shrink-0 text-xs text-zinc-500 hover:text-white transition"
        >
          retry
        </button>
      </div>
    );
  }

  // visible skeleton while loading
  if (isLoading || !rawEvent) {
    return (
      <div className="h-28 animate-pulse rounded-xl border border-zinc-700 bg-zinc-800/60" />
    );
  }

  const evt = rawEvent as unknown as EventData;

  if (!evt.name) {
    return (
      <div className="h-28 animate-pulse rounded-xl border border-zinc-700 bg-zinc-800/60" />
    );
  }

  const dateStr = new Date(Number(evt.eventDate) * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const imageUrl = ipfsToHttp(evt.imageURI);

  function handleToggle() {
    setToggling(true);
    writeContract(
      {
        abi: PIZZA_POAP_ABI,
        address: PIZZA_POAP_ADDRESS,
        functionName: "setEventActive",
        args: [BigInt(eventId), !evt.active],
      },
      {
        onSuccess: () => {
          toast.loading("Waiting for confirmation...", { id: "toggle-pending" });
        },
        onError: (err) => {
          toast.error(`Failed: ${err.message.slice(0, 60)}`);
          setToggling(false);
        },
      }
    );
  }

  return (
    <div className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      {/* artwork thumbnail */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800 flex items-center justify-center">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={evt.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).replaceWith(
                Object.assign(document.createElement("span"), {
                  textContent: "🍕",
                  className: "text-2xl",
                })
              );
            }}
          />
        ) : (
          <span className="text-2xl">🍕</span>
        )}
      </div>

      {/* event details */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white">{evt.name}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              evt.active ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {evt.active ? "active" : "inactive"}
          </span>
        </div>

        <p className="text-xs text-zinc-500">
          {dateStr} · event #{eventId} · {evt.mintCount.toString()} tokens minted
        </p>

        <p className="truncate text-xs text-zinc-600">{evt.description}</p>
      </div>

      {/* active/inactive toggle */}
      <button
        onClick={handleToggle}
        disabled={toggling}
        title={evt.active ? "Deactivate minting" : "Reactivate minting"}
        className={`shrink-0 self-center rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          evt.active
            ? "border-zinc-700 text-zinc-400 hover:border-red-800 hover:text-red-400"
            : "border-zinc-700 text-zinc-400 hover:border-green-800 hover:text-green-400"
        }`}
      >
        {toggling ? "…" : evt.active ? "Deactivate" : "Reactivate"}
      </button>
    </div>
  );
}

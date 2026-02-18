"use client";

// shows all past events read directly from the contract
// each card has: artwork, name, date, mint count, and an active/inactive toggle
// think of it like a table of contents for every call that ever happened

import { useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import toast from "react-hot-toast";
import { PIZZA_POAP_ABI, PIZZA_POAP_ADDRESS } from "@/lib/contract";
import { ipfsToHttp } from "@/lib/pinata";

// shape of the tuple returned by events(eventId)
type EventData = {
  name: string;
  description: string;
  imageURI: string;
  eventDate: bigint;
  mintCount: bigint;
  active: boolean;
};

export function EventList({ refreshKey }: { refreshKey: number }) {
  // get total event count so we know how many to fetch
  const { data: totalRaw } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "totalEvents",
    // refreshKey changes when a new event is created, forcing a re-read
    scopeKey: `events-${refreshKey}`,
  });
  const total = totalRaw ? Number(totalRaw as bigint) : 0;

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500">
        No events yet. Create one above to get started.
      </p>
    );
  }

  // render cards newest-first (highest id first)
  const ids = Array.from({ length: total }, (_, i) => total - 1 - i);

  return (
    <div className="flex flex-col gap-4">
      {ids.map((id) => (
        <EventCard key={id} eventId={id} />
      ))}
    </div>
  );
}

// individual event card -- reads its own data and owns its toggle state
function EventCard({ eventId }: { eventId: number }) {
  const [toggling, setToggling] = useState(false);

  const { data: rawEvent, refetch } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "events",
    args: [BigInt(eventId)],
  });

  const { writeContract, data: txHash } = useWriteContract();

  // watch for the toggle tx to confirm, then refetch this card's data
  const { isSuccess: toggleConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (toggleConfirmed && toggling) {
    toast.dismiss("toggle-pending");
    toast.success("Event updated ✓");
    setToggling(false);
    refetch();
  }

  // loading skeleton while data arrives
  if (!rawEvent) {
    return (
      <div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
    );
  }

  // viem returns named tuple fields as object properties
  // the cast goes through unknown to avoid typescript narrowing issues
  const evt = rawEvent as unknown as EventData;

  // guard: if fields haven't populated yet, keep showing skeleton
  if (!evt.name) {
    return (
      <div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />
    );
  }

  const date = new Date(Number(evt.eventDate) * 1000);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={evt.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            // fallback to pizza emoji if image fails to load
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      {/* event details */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white">{evt.name}</p>
          {/* active/inactive badge */}
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              evt.active
                ? "bg-green-900/50 text-green-400"
                : "bg-zinc-800 text-zinc-500"
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

      {/* toggle button */}
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

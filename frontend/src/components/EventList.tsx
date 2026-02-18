"use client";

// shows all past events read directly from the contract
// uses usePublicClient + useEffect to read events directly via viem
// (wagmi's useReadContracts multicall silently fails on monad testnet
//  because multicall3 is not deployed at the standard address)

import { useState, useEffect, useCallback } from "react";
import { usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
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
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<(EventData | null)[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");

  const loadEvents = useCallback(async () => {
    if (!publicClient) return;
    setLoadError("");

    try {
      // read total events first
      const totalRaw = await publicClient.readContract({
        address: PIZZA_POAP_ADDRESS,
        abi: PIZZA_POAP_ABI,
        functionName: "totalEvents",
      });
      const n = Number(totalRaw as bigint);
      setTotal(n);

      if (n === 0) {
        setEvents([]);
        return;
      }

      // read each event sequentially to avoid rate limits
      // newest first (highest id first)
      const ids = Array.from({ length: n }, (_, i) => n - 1 - i);
      const results: (EventData | null)[] = [];

      for (const id of ids) {
        try {
          const raw = await publicClient.readContract({
            address: PIZZA_POAP_ADDRESS,
            abi: PIZZA_POAP_ABI,
            functionName: "events",
            args: [BigInt(id)],
          });
          // viem returns the tuple as a plain array [name, description, imageURI, eventDate, mintCount, active]
          const arr = raw as unknown as [string, string, string, bigint, bigint, boolean];
          results.push({
            name:        arr[0],
            description: arr[1],
            imageURI:    arr[2],
            eventDate:   arr[3],
            mintCount:   arr[4],
            active:      arr[5],
          });
        } catch (err) {
          console.error(`[EventList] event #${id} read failed:`, err);
          results.push(null);
        }
        // small delay between reads to avoid rate limits on testnet
        await new Promise((r) => setTimeout(r, 300));
      }

      setEvents(results);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "failed to load events";
      setLoadError(msg);
    }
  }, [publicClient]);

  // load on mount and when refreshKey changes
  useEffect(() => {
    loadEvents();
  }, [loadEvents, refreshKey]);

  // still initialising
  if (total === null) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-zinc-700 bg-zinc-800/60" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3">
        <p className="text-xs text-red-400">{loadError}</p>
        <button onClick={loadEvents} className="text-xs text-zinc-400 hover:text-white transition">
          retry
        </button>
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

  const ids = Array.from({ length: total }, (_, i) => total - 1 - i);

  return (
    <div className="flex flex-col gap-4">
      {ids.map((id, index) => (
        <EventCard
          key={id}
          eventId={id}
          evt={events[index] ?? null}
          onRefetch={loadEvents}
        />
      ))}
    </div>
  );
}

function EventCard({
  eventId,
  evt,
  onRefetch,
}: {
  eventId: number;
  evt: EventData | null;
  onRefetch: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const { writeContract, data: txHash } = useWriteContract();
  const { isSuccess: toggleConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  if (toggleConfirmed && toggling) {
    toast.dismiss("toggle-pending");
    toast.success("Event updated ✓");
    setToggling(false);
    onRefetch();
  }

  // skeleton while this event's data is still loading
  if (!evt || !evt.name) {
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
        args: [BigInt(eventId), !evt!.active],
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
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800 flex items-center justify-center text-2xl">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={evt.name}
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : "🍕"}
      </div>

      {/* event info */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white">{evt.name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            evt.active ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"
          }`}>
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

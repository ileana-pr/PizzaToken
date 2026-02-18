"use client";

// dispense panel -- visual, click-to-select flow
// step 1: auto-detects the latest attendance sheet
// step 2: admin clicks an event card to select it
// step 3: hits "Dispense" -- tokens mint, sheet gets marked

import { useState, useEffect, useCallback } from "react";
import { useReadContract } from "wagmi";
import toast from "react-hot-toast";
import { PIZZA_POAP_ABI, PIZZA_POAP_ADDRESS } from "@/lib/contract";
import { ipfsToHttp } from "@/lib/pinata";
import type { LatestSheetInfo } from "@/app/api/dispense/route";

// shape returned by the events() contract function
type EventData = {
  name: string;
  description: string;
  imageURI: string;
  eventDate: bigint;
  mintCount: bigint;
  active: boolean;
};

type PanelState = "loading-sheet" | "picking" | "dispensing" | "success" | "error";

interface DispenseResult {
  success: boolean;
  date: string;
  mintedCount: number;
  skippedCount: number;
  noWalletCount: number;
  alreadyMintedCount: number;
  txHash?: string;
  attendees?: { name: string; wallet: string }[];
  error?: string;
}

export function DispensePanel() {
  const [state, setState] = useState<PanelState>("loading-sheet");
  const [preview, setPreview] = useState<LatestSheetInfo | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [result, setResult] = useState<DispenseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // load the auto-detected sheet preview from the api
  const loadPreview = useCallback(async () => {
    setState("loading-sheet");
    setPreview(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/dispense");
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "failed to load sheet preview");
        setState("error");
        return;
      }
      setPreview(data as LatestSheetInfo);
      setState("picking");
    } catch (err: any) {
      setErrorMsg(err.message || "network error");
      setState("error");
    }
  }, []);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  // read total event count from the contract so we know how many cards to show
  const { data: totalRaw } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "totalEvents",
  });
  const total = totalRaw ? Number(totalRaw as bigint) : 0;

  async function handleDispense() {
    if (selectedEventId === null) return;
    setState("dispensing");
    const toastId = toast.loading("Reading attendance sheet & minting...");
    try {
      const res = await fetch("/api/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: selectedEventId }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (!res.ok || !data.success) {
        toast.error("Dispense failed");
        setErrorMsg(data.error || "unknown error");
        setState("error");
        return;
      }
      setResult(data as DispenseResult);
      setState("success");
      toast.success(`${data.mintedCount} tokens minted! 🍕`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Request failed");
      setErrorMsg(err.message || "network error");
      setState("error");
    }
  }

  function handleReset() {
    setResult(null);
    setSelectedEventId(null);
    loadPreview();
  }

  // ── loading ────────────────────────────────────────────────
  if (state === "loading-sheet") {
    return (
      <div className="flex items-center gap-3 py-6 text-sm text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
        Detecting latest attendance sheet...
      </div>
    );
  }

  // ── error ──────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
        <button
          onClick={loadPreview}
          className="self-start rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── success ────────────────────────────────────────────────
  if (state === "success" && result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-green-900 bg-green-950/20 p-5">
          <p className="mb-4 text-sm font-semibold text-green-400">
            Tokens dispensed for {result.date} 🍕
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultStat label="Minted"        value={result.mintedCount}       color="text-green-400" />
            <ResultStat label="Skipped"       value={result.skippedCount}      color="text-zinc-400" />
            <ResultStat label="No wallet"     value={result.noWalletCount}     color="text-yellow-500" />
            <ResultStat label="Already done"  value={result.alreadyMintedCount} color="text-zinc-500" />
          </div>
          {result.txHash && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-zinc-500">tx:</span>
              <a
                href={`https://testnet.monadexplorer.com/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-xs text-orange-400 hover:text-orange-300"
              >
                {result.txHash}
              </a>
            </div>
          )}
        </div>

        {result.attendees && result.attendees.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-500">
              Attendees ({result.attendees.length})
            </p>
            <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
              {result.attendees.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-300">{a.name}</span>
                  <span className="truncate font-mono text-xs text-zinc-600">{a.wallet}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleReset}
          className="self-start rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition"
        >
          Dispense for another event
        </button>
      </div>
    );
  }

  // ── picking + dispensing (main view) ───────────────────────
  const isBusy = state === "dispensing";

  return (
    <div className="flex flex-col gap-5">

      {/* detected sheet banner */}
      {preview && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3">
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Latest attendance sheet detected</p>
            <p className="text-sm font-semibold text-white">{preview.date}</p>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <Pill value={preview.toMintCount}       label="ready to mint"   hot={preview.toMintCount > 0} />
              <Pill value={preview.alreadyMintedCount} label="already minted" />
              <Pill value={preview.noWalletCount}      label="no wallet on file" warn={preview.noWalletCount > 0} />
            </div>
          </div>
          <button
            type="button"
            onClick={loadPreview}
            disabled={isBusy}
            title="Re-detect latest sheet"
            className="mt-0.5 shrink-0 text-xs text-zinc-600 hover:text-zinc-400 transition disabled:opacity-40"
          >
            ↻
          </button>
        </div>
      )}

      {/* event picker */}
      <div>
        <p className="mb-3 text-sm font-medium text-zinc-300">
          Pick the event to send tokens for
        </p>

        {total === 0 ? (
          <p className="text-sm text-zinc-500">No events yet — create one above first.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* show newest first */}
            {Array.from({ length: total }, (_, i) => total - 1 - i).map((id) => (
              <EventCard
                key={id}
                eventId={id}
                selected={selectedEventId === id}
                disabled={isBusy}
                onSelect={() => setSelectedEventId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* no wallet warning */}
      {preview && preview.noWalletCount > 0 && (
        <p className="text-xs text-yellow-600">
          ⚠ {preview.noWalletCount} attendee{preview.noWalletCount !== 1 ? "s" : ""} in this sheet
          don&apos;t have a wallet address in the crew sheet yet — they won&apos;t receive a token.
        </p>
      )}

      {/* dispense button */}
      <button
        onClick={handleDispense}
        disabled={isBusy || selectedEventId === null || preview?.toMintCount === 0}
        className="flex w-fit items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy ? (
          <><Spinner /> Dispensing...</>
        ) : selectedEventId === null ? (
          <>🍕 Select an event above</>
        ) : (
          <>🍕 Dispense {preview?.toMintCount ?? ""} Tokens</>
        )}
      </button>
    </div>
  );
}

// ── individual event card ──────────────────────────────────────────────────────

function EventCard({
  eventId,
  selected,
  disabled,
  onSelect,
}: {
  eventId: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { data: rawEvent } = useReadContract({
    abi: PIZZA_POAP_ABI,
    address: PIZZA_POAP_ADDRESS,
    functionName: "events",
    args: [BigInt(eventId)],
  });

  // skeleton while loading
  if (!rawEvent) {
    return <div className="h-20 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />;
  }

  const evt = rawEvent as unknown as EventData;
  if (!evt.name) {
    return <div className="h-20 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />;
  }

  const date = new Date(Number(evt.eventDate) * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const imageUrl = ipfsToHttp(evt.imageURI);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition
        ${selected
          ? "border-orange-500 bg-orange-950/30 ring-1 ring-orange-500"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
        }
        disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {/* artwork thumbnail */}
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={evt.name}
          className="h-full w-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      {/* details */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{evt.name}</p>
        <p className="text-xs text-zinc-500">{date} · event #{eventId}</p>
        <p className="text-xs text-zinc-600">{evt.mintCount.toString()} tokens minted</p>
      </div>

      {/* selected checkmark */}
      {selected && (
        <span className="shrink-0 text-lg text-orange-400">✓</span>
      )}
    </button>
  );
}

// ── small ui helpers ─────────────────────────────────────────────────────────

function Pill({ value, label, hot, warn }: { value: number; label: string; hot?: boolean; warn?: boolean }) {
  const color = hot ? "text-orange-400" : warn ? "text-yellow-500" : "text-zinc-500";
  return (
    <span className={`text-xs ${color}`}>
      <span className="font-bold">{value}</span> {label}
    </span>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

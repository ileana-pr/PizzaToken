"use client";

// unified send-tokens flow -- replaces both CreateEventForm and DispensePanel
//
// step 1: pick a call from the master sheet list
// step 2: upload the artwork for that call's token
// step 3: hit "Send Tokens" -- image uploads to ipfs, event creates on-chain,
//         tokens mint to all matched wallets, sheet rows marked done

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { uploadToIPFS } from "@/lib/pinata";
import type { CallRow } from "@/app/api/dispense/route";

type SenderState = "loading" | "picking" | "sending" | "success" | "error";

interface SendResult {
  eventId: number;
  date: string;
  mintedCount: number;
  skippedCount: number;
  noWalletCount: number;
  alreadyMintedCount: number;
  txHash?: string;
  attendees?: { name: string; wallet: string }[];
}

export function CallTokenSender({ onSent }: { onSent?: () => void }) {
  const [state, setState]               = useState<SenderState>("loading");
  const [calls, setCalls]               = useState<CallRow[]>([]);
  const [selected, setSelected]         = useState<CallRow | null>(null);
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult]             = useState<SendResult | null>(null);
  const [errorMsg, setErrorMsg]         = useState("");
  const [progressMsg, setProgressMsg]   = useState("");
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // fetch the call list from the master sheet on mount
  useEffect(() => {
    async function loadCalls() {
      try {
        const res  = await fetch("/api/dispense");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "failed to load calls");
        setCalls(data.calls as CallRow[]);
        setState("picking");
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "could not load call list");
        setState("error");
      }
    }
    loadCalls();
  }, []);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleClearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend() {
    if (!selected?.sheetId || !imageFile) return;
    setState("sending");

    try {
      // step 1: upload artwork to ipfs via pinata
      setProgressMsg("Uploading artwork to IPFS...");
      const uploadResult = await uploadToIPFS(imageFile);
      if (!uploadResult.ok) throw new Error(`IPFS upload failed: ${uploadResult.error}`);
      const imageUri = uploadResult.uri;

      // step 2: create event on-chain + read sheet + mint + mark done (all server-side)
      setProgressMsg("Creating event & sending tokens on Monad...");
      const res  = await fetch("/api/dispense", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          sheetId:  selected.sheetId,
          date:     selected.date,
          imageUri,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || "dispense failed");

      setResult(data as SendResult);
      setState("success");
      toast.success(`${data.mintedCount} tokens sent! 🍕`);
      onSent?.(); // tell the parent to refresh the past events list
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "something went wrong");
      setState("error");
      toast.error("Failed to send tokens");
    }
  }

  function handleReset() {
    setSelected(null);
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setErrorMsg("");
    setProgressMsg("");
    setState("picking");
  }

  // ── loading ────────────────────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 py-8 text-sm text-zinc-500">
        <Spinner /> Loading call history from master sheet...
      </div>
    );
  }

  // ── error ──────────────────────────────────────────────────────────────────

  if (state === "error") {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
        <button
          onClick={handleReset}
          className="self-start rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── sending ────────────────────────────────────────────────────────────────

  if (state === "sending") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-orange-500" />
        <div>
          <p className="text-sm font-medium text-white">{progressMsg}</p>
          <p className="mt-1 text-xs text-zinc-500">
            This can take up to a minute — don&apos;t close the tab
          </p>
        </div>
      </div>
    );
  }

  // ── success ────────────────────────────────────────────────────────────────

  if (state === "success" && result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-green-900 bg-green-950/20 p-5">
          <p className="mb-1 text-base font-semibold text-green-400">
            Tokens sent for {result.date} 🍕
          </p>
          <p className="mb-4 text-xs text-zinc-500">
            On-chain event #{result.eventId} created
          </p>

          {/* result stats grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Tokens sent"    value={result.mintedCount}        color="text-green-400" />
            <Stat label="Skipped"        value={result.skippedCount}       color="text-zinc-400" />
            <Stat label="No wallet"      value={result.noWalletCount}      color="text-yellow-500" />
            <Stat label="Already minted" value={result.alreadyMintedCount} color="text-zinc-500" />
          </div>

          {/* tx hash link */}
          {result.txHash && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-zinc-500">tx:</span>
              <a
                href={`https://testnet.monadexplorer.com/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-xs text-orange-400 hover:underline"
              >
                {result.txHash}
              </a>
            </div>
          )}
        </div>

        {/* attendee list */}
        {result.attendees && result.attendees.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-500">
              Received tokens ({result.attendees.length})
            </p>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
              {result.attendees.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-xs text-zinc-300">{a.name}</span>
                  <span className="truncate font-mono text-xs text-zinc-600">{a.wallet}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleReset}
          className="self-start rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-white transition"
        >
          Send for another call
        </button>
      </div>
    );
  }

  // ── main picking view ──────────────────────────────────────────────────────

  const canSend = !!selected?.sheetId && !!imageFile;

  return (
    <div className="flex flex-col gap-6">

      {/* ── step 1: pick a call ── */}
      <div>
        <StepLabel number={1} text="Pick a call" />

        {calls.length === 0 ? (
          <p className="text-sm text-zinc-500">No calls found in master sheet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {calls.map((call, i) => {
              const isSelectable = !!call.sheetId;
              const isSelected   = selected?.masterRow === call.masterRow;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!isSelectable}
                  onClick={() => setSelected(call)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition
                    ${isSelected
                      ? "border-orange-500 bg-orange-950/30 ring-1 ring-orange-500"
                      : isSelectable
                        ? "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                        : "border-zinc-800/50 bg-zinc-900/50 cursor-not-allowed opacity-40"
                    }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      Pizza DAO Community Call
                    </p>
                    <p className="text-xs text-zinc-500">{call.date}</p>
                    {!isSelectable && (
                      <p className="text-xs text-yellow-700">no sheet url — update master sheet</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {/* attendance count badge */}
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                      {call.attendanceCount} attended
                    </span>
                    {/* checkmark when selected */}
                    {isSelected && (
                      <span className="text-lg text-orange-400">✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── step 2: upload artwork (only shows after a call is selected) ── */}
      {selected && (
        <div>
          <StepLabel number={2} text="Upload token artwork" />

          <div className="mt-3">
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="token artwork preview"
                  className="h-44 w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute right-2 top-2 rounded-full bg-zinc-900/80 px-2 py-0.5 text-xs text-zinc-300 hover:text-white"
                >
                  ✕ remove
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 py-10 text-center transition hover:border-orange-600">
                <span className="text-3xl">🖼️</span>
                <span className="text-sm text-zinc-400">Click to upload artwork</span>
                <span className="text-xs text-zinc-600">PNG, JPG, GIF — will be pinned to IPFS</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* ── send button ── */}
      {selected && (
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-3.5 text-sm font-bold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!imageFile
            ? "Upload artwork to continue"
            : `🍕 Send Tokens for ${selected.date}`}
        </button>
      )}
    </div>
  );
}

// ── small helpers ──────────────────────────────────────────────────────────────

function StepLabel({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
        {number}
      </span>
      <span className="text-sm font-semibold text-zinc-300">{text}</span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

"use client";

// speaker notes panel -- toggled on/off during the demo
// only visible to the presenter, hidden from the audience by toggling
// think of it like a teleprompter that lives at the bottom of the screen

import { useState } from "react";

const NOTES = [
  {
    cue: "Opening (0:00)",
    points: [
      "Start on the /demo page, not the dashboard -- sets context before showing the tool",
      "One sentence hook: 'PizzaDAO runs weekly calls -- we wanted an attendance token that lives on-chain, not in a Google Sheet'",
      "Emphasise: zero backend, no database, everything is the wallet + chain + IPFS",
    ],
    watch: "Don't open MetaMask yet -- just talk over the problem cards",
  },
  {
    cue: "Stack (0:30)",
    points: [
      "Hit the six cards fast -- layer / name / one-liner each",
      "Monad: 'same EVM tooling you already know, just faster and cheaper on testnet'",
      "wagmi: 'replaces web3.js/ethers hooks with typed React hooks -- useWriteContract, useReadContract'",
      "IPFS/Pinata: 'we don't store images in the contract -- we store a CID. Image lives forever on IPFS'",
    ],
    watch: "Skip explaining RainbowKit -- devs know it. Just say 'wallet connect, handled'",
  },
  {
    cue: "Architecture (1:00)",
    points: [
      "Trace the orange solid arrows first: browser → Monad contract (the on-chain writes)",
      "Then trace the dashed blue arrows: browser → Pinata → IPFS → URI comes back",
      "Key insight: the contract only stores strings -- name, description, ipfs:// URI, date",
      "'There is no server in this diagram. The browser IS the backend'",
    ],
    watch: "If someone asks about the dispense script -- it's a Hardhat task, runs locally post-call",
  },
  {
    cue: "Live Flow (1:30)",
    points: [
      "Switch to the dashboard now -- connect the admin wallet on Monad Testnet",
      "Show the owner() check failing on a wrong wallet if you have one handy (good dev detail)",
      "Fill the create event form: name, description, date, drop a pizza image",
      "Walk through the two-step submit: Pinata upload toast → tx pending toast → confirmed",
    ],
    watch: "Have a pizza image ready on your desktop -- don't fumble for a file during the demo",
  },
  {
    cue: "Mint Toggle (2:15)",
    points: [
      "In EventList, show the active toggle -- one click, one tx, no redeployment",
      "setEventActive(id, false) = gate closed, nobody can mint. setEventActive(id, true) = open",
      "This is the key admin control -- you open minting during the call, close it after",
    ],
    watch: "Don't demo the dispense script live -- just show the npm run dispense line in the success screen",
  },
  {
    cue: "Wrap (2:45)",
    points: [
      "Back to /demo page for the CTA -- Monad Explorer link shows the tx on-chain",
      "Repo is open source -- contract, dispense script, frontend all in one monorepo",
      "Invite: 'fork it, change the contract address, run your own DAO attendance token'",
    ],
    watch: "Leave 15 seconds for questions -- most common: 'can attendees claim it themselves?' (future feature)",
  },
];

export function SpeakerNotes() {
  const [open, setOpen] = useState(false);
  const [activeNote, setActiveNote] = useState(0);

  return (
    <>
      {/* floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 shadow-xl transition hover:border-zinc-500 hover:text-white"
        aria-label="toggle speaker notes"
      >
        <span>{open ? "✕" : "📋"}</span>
        {open ? "close notes" : "speaker notes"}
      </button>

      {/* slide-up notes panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[360px] rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
          {/* panel header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-400">
              📋 Speaker Notes
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {activeNote + 1} / {NOTES.length}
            </span>
          </div>

          {/* cue tabs */}
          <div className="flex overflow-x-auto border-b border-zinc-800 scrollbar-hide">
            {NOTES.map((n, i) => (
              <button
                key={n.cue}
                onClick={() => setActiveNote(i)}
                className={`shrink-0 px-3 py-2 text-xs font-mono transition whitespace-nowrap ${
                  i === activeNote
                    ? "border-b-2 border-orange-500 text-orange-400 bg-zinc-800"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {n.cue.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* active note content */}
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            <p className="text-xs font-semibold text-zinc-200 font-mono">
              {NOTES[activeNote].cue}
            </p>

            {/* talking points */}
            <ul className="space-y-2">
              {NOTES[activeNote].points.map((pt, i) => (
                <li key={i} className="flex gap-2 text-xs text-zinc-300 leading-relaxed">
                  <span className="text-orange-500 shrink-0 mt-0.5">›</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>

            {/* watch out callout */}
            <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-3 py-2">
              <p className="text-xs text-yellow-400 leading-relaxed">
                <span className="font-semibold">⚠ watch: </span>
                {NOTES[activeNote].watch}
              </p>
            </div>
          </div>

          {/* prev / next nav */}
          <div className="flex border-t border-zinc-800">
            <button
              onClick={() => setActiveNote((n) => Math.max(0, n - 1))}
              disabled={activeNote === 0}
              className="flex-1 py-2.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition border-r border-zinc-800"
            >
              ← prev
            </button>
            <button
              onClick={() => setActiveNote((n) => Math.min(NOTES.length - 1, n + 1))}
              disabled={activeNote === NOTES.length - 1}
              className="flex-1 py-2.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition"
            >
              next →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

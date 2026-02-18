// demo page -- 3-minute dev walkthrough
// structure: problem → stack → architecture → cta
// designed as a visual talking guide, not a slide deck

import Link from "next/link";
import { SpeakerNotes } from "@/components/SpeakerNotes";

// --- data ------------------------------------------------------------------

const PROBLEM_POINTS = [
  {
    icon: "😓",
    heading: "POAP exists — but it's a manual mess",
    body: "PizzaDAO already issues POAPs for weekly calls. Done by hand: staff tracks who showed up, manually airdrops each token. With a lean team, tokens get missed or delayed every single week.",
  },
  {
    icon: "🌾",
    heading: "Manual = farmable + unreliable",
    body: "When distribution is human-powered, bad actors game it. People join for 30 seconds to grab the token. Staff burn out. Not everyone who actually attended gets one. The record is dirty.",
  },
  {
    icon: "⚡",
    heading: "The fix: pick a call, upload art, click send",
    body: "Pizza Token reads the attendance straight from Google Sheets. Admin picks the call, drops the artwork, hits Send — every wallet in the sheet gets an ERC-721 token. One action, no staff needed.",
  },
];

const STACK = [
  {
    layer: "Chain",
    name: "Monad Testnet",
    detail: "EVM-compatible, chain ID 10143 — fast finality, cheap txs",
    color: "border-purple-500 text-purple-400",
  },
  {
    layer: "Contract",
    name: "Solidity ERC-721",
    detail: "createEvent() · setEventActive() · mint() — owner-gated admin ops",
    color: "border-orange-500 text-orange-400",
  },
  {
    layer: "Storage",
    name: "IPFS via Pinata",
    detail: "Event artwork pinned on IPFS, ipfs:// URI written into the token",
    color: "border-blue-500 text-blue-400",
  },
  {
    layer: "Frontend",
    name: "Next.js 15 + Tailwind",
    detail: "App router, server components where possible, dark-mode UI",
    color: "border-green-500 text-green-400",
  },
  {
    layer: "Web3 hooks",
    name: "wagmi v2 + viem",
    detail: "useWriteContract · useWaitForTransactionReceipt · useReadContract",
    color: "border-cyan-500 text-cyan-400",
  },
  {
    layer: "Wallet UI",
    name: "RainbowKit",
    detail: "Connect button, chain switching, WalletConnect — zero config",
    color: "border-pink-500 text-pink-400",
  },
  {
    layer: "Attendance",
    name: "Google Sheets API",
    detail: "Master sheet → call list · attendance sheet → Discord IDs · crew sheet → wallet map",
    color: "border-indigo-500 text-indigo-400",
  },
  {
    layer: "API Route",
    name: "Next.js /api/dispense",
    detail: "Server-side: reads sheets → createEvent() → batchMint() via ethers.js — all in one POST",
    color: "border-yellow-500 text-yellow-400",
  },
];

// each step maps to roughly 25 seconds of talking
const FLOW_STEPS = [
  {
    time: "0:00",
    step: "Connect wallet — owner check",
    detail: "RainbowKit connects the wallet. The app reads owner() from the contract — only the deployer address sees the dashboard.",
    code: `const isOwner = address?.toLowerCase() === ownerAddress?.toLowerCase();`,
  },
  {
    time: "0:25",
    step: "Step 1 — pick a call from the master sheet",
    detail: "GET /api/dispense reads the Google master sheet and returns every weekly call as a card with date and attendance count. Admin clicks the one they want.",
    code: `// GET /api/dispense\nconst calls = await readMasterSheet(); // returns CallRow[]\n// CallRow: { date, sheetId, attendanceCount, masterRow }`,
  },
  {
    time: "0:55",
    step: "Step 2 — upload token artwork",
    detail: "Once a call is selected the artwork uploader appears. Admin drops the image — it stays local until Send is hit.",
    code: `// client-side preview only at this point\nconst preview = URL.createObjectURL(file);`,
  },
  {
    time: "1:20",
    step: "Artwork → IPFS via Pinata",
    detail: "On Send, the client uploads the image to Pinata first. The ipfs:// URI is returned and passed to the server.",
    code: `const result = await uploadToIPFS(imageFile);\n// result.uri === "ipfs://Qm..."`,
  },
  {
    time: "1:45",
    step: "Server: createEvent() on Monad",
    detail: "POST /api/dispense takes sheetId + date + imageUri. The API route signs and sends createEvent() to the contract using ethers.js with the admin private key.",
    code: `// POST /api/dispense (server-side)\nawait contract.createEvent(name, desc, imageUri, unixDate);`,
  },
  {
    time: "2:10",
    step: "Server: sheet → wallet map → batchMint()",
    detail: "The API route reads the call's attendance sheet, cross-references Discord IDs against the crew sheet to get wallet addresses, then calls batchMint() for all matched wallets in one tx.",
    code: `const wallets = await resolveWallets(attendanceSheet, crewSheet);\nawait contract.batchMint(eventId, wallets);`,
  },
  {
    time: "2:35",
    step: "Result: minted · skipped · no wallet",
    detail: "The dashboard shows a receipt: tokens sent, skipped (already minted), and attendees with no wallet on file. The tx hash links to Monad Explorer.",
    code: `// { mintedCount, skippedCount, noWalletCount, txHash }\n// sheet rows marked as done automatically`,
  },
];

const REUSE_POINTS = [
  {
    icon: "🔧",
    heading: "The contract is chain-agnostic",
    body: "Deployed on any EVM chain. Change one env var to point at your network and the whole app follows — Monad, Base, Ethereum, whatever your DAO runs on.",
  },
  {
    icon: "📋",
    heading: "The sheet structure is the only convention",
    body: "Master sheet: date · attendance sheet link · count. Attendance sheet: name · Discord ID. Crew sheet: Discord ID · wallet. That's it. Your DAO probably already has this.",
  },
  {
    icon: "🚀",
    heading: "No Solidity required to operate",
    body: "Deploy once, hand over the admin wallet, done. The operator just needs the dashboard URL and their Google Sheets — everything else is automated.",
  },
];

const SETUP_STEPS = [
  {
    action: "Deploy the contract",
    detail: "Run the Hardhat deploy script against any EVM testnet or mainnet. Takes 30 seconds.",
    code: `npx hardhat run scripts/deploy.ts --network monad`,
  },
  {
    action: "Set up three Google Sheets",
    detail: "Master sheet (one row per call), an attendance sheet per call, and a crew sheet mapping Discord ID → wallet address.",
    code: null,
  },
  {
    action: "Fill in .env.local",
    detail: "Contract address, RPC URL, admin private key, Google service account credentials, master sheet ID.",
    code: `NEXT_PUBLIC_PIZZA_POAP_CONTRACT=0x...\nGOOGLE_SERVICE_ACCOUNT_EMAIL=...\nMASTER_SHEET_ID=...`,
  },
  {
    action: "Run the frontend",
    detail: "npm install && npm run dev. Connect the admin wallet and the dashboard is live. No other infrastructure needed.",
    code: `cd frontend && npm install && npm run dev`,
  },
];

// --- page ------------------------------------------------------------------

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* top nav */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍕</span>
            <span className="font-bold text-white">Pizza Token</span>
            <span className="ml-2 rounded bg-orange-900/40 px-2 py-0.5 text-xs text-orange-400 font-mono">
              demo
            </span>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500"
          >
            → Open Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 space-y-20">

        {/* ── section 1: the problem ── */}
        <section>
          <SectionLabel number="01" label="The Problem" time="~30 sec" />
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            PizzaDAO had attendance tokens. The problem was everything around them.
          </h2>
          <p className="mt-3 text-zinc-400 max-w-2xl">
            The on-chain record existed — but getting tokens to the right people was slow,
            error-prone, and easy to game. We built a minimal admin dashboard that turns
            each call into an ERC-721 token —{" "}
            <span className="text-white font-medium">
              one click to create an event, one button to dispense tokens to every attendee.
            </span>
          </p>
          <p className="mt-2 text-zinc-500 max-w-2xl text-sm">
            Attendance comes straight from Google Sheets — no manual list, no copy-paste,
            no human error. The app cross-references Discord IDs to wallet addresses and
            batch-mints on Monad automatically.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {PROBLEM_POINTS.map((p) => (
              <div
                key={p.heading}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <span className="text-3xl">{p.icon}</span>
                <h3 className="mt-3 text-sm font-semibold text-white">{p.heading}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── section 2: tech stack ── */}
        <section>
          <SectionLabel number="02" label="Tech Stack" time="~45 sec" />
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Eight layers, zero custom backend.
          </h2>
          <p className="mt-3 text-zinc-400 max-w-2xl">
            No database, no separate server, no deploy pipeline. The Next.js API route
            is the only server-side code — it reads Google Sheets, signs transactions
            with ethers.js, and calls the contract. Everything else runs in the browser
            or on-chain.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STACK.map((s) => (
              <div
                key={s.layer}
                className={`rounded-xl border bg-zinc-900 p-5 ${s.color.split(" ")[0]}`}
              >
                <span className={`text-xs font-mono font-bold uppercase tracking-widest ${s.color.split(" ")[1]}`}>
                  {s.layer}
                </span>
                <h3 className="mt-1 text-base font-semibold text-white">{s.name}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{s.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── section 3: architecture diagram ── */}
        <section>
          <SectionLabel number="03" label="Architecture" time="~30 sec" />
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Zero backend. Three external systems.
          </h2>
          <p className="mt-3 text-zinc-400 max-w-2xl">
            The browser talks directly to the wallet, IPFS, and the chain.
            No API server, no database — every piece of state lives on-chain or on IPFS.
          </p>
          <ArchDiagram />
        </section>

        {/* ── section 4: live flow ── */}
        <section>
          <SectionLabel number="04" label="Live Flow" time="~90 sec" />
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            From wallet connect to token in wallet — step by step.
          </h2>
          <p className="mt-3 text-zinc-400 max-w-2xl">
            Each row below is roughly 15 seconds of the live demo. The code
            snippets are the actual lines doing the work.
          </p>

          {/* dashboard screenshot */}
          <div className="mt-8 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl">
            <div className="rounded-xl overflow-hidden border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dashboard-screenshot.png"
                alt="Pizza Token admin dashboard — showing 3 total events, 33 tokens minted, and the Send Call Tokens panel after a successful dispense"
                className="w-full"
              />
            </div>
            {/* annotated callouts */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Stats bar",       detail: "Live on-chain reads — total events + tokens minted" },
                { label: "Send Call Tokens", detail: "Unified 3-step flow: pick call → artwork → send" },
                { label: "Result receipt",   detail: "Minted / skipped / no wallet / already minted breakdown" },
                { label: "Past Events",      detail: "Toggle mint active/inactive per event, no redeployment" },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <p className="text-xs font-semibold text-orange-400">{c.label}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{c.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 relative">
            {/* vertical connector line */}
            <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-zinc-800 hidden sm:block" />

            <div className="flex flex-col gap-0">
              {FLOW_STEPS.map((s, i) => (
                <div
                  key={s.step}
                  className="relative flex gap-4 sm:gap-8 pb-6 last:pb-0"
                >
                  {/* timestamp + dot */}
                  <div className="flex flex-col items-center gap-1 shrink-0 w-24 sm:w-28">
                    <span className="text-xs font-mono text-orange-500 bg-zinc-950 relative z-10">
                      {s.time}
                    </span>
                    <div className="h-3 w-3 rounded-full border-2 border-orange-500 bg-zinc-950 relative z-10" />
                  </div>

                  {/* content */}
                  <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4 -mt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono text-zinc-500">step {i + 1}</span>
                        <h3 className="text-sm font-semibold text-white mt-0.5">{s.step}</h3>
                        <p className="text-xs text-zinc-400 mt-1">{s.detail}</p>
                      </div>
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 px-3 py-2.5 text-xs text-orange-300 font-mono leading-relaxed border border-zinc-800">
                      {s.code}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── section 5: built for every dao ── */}
        <section>
          <SectionLabel number="05" label="Built for Every DAO" time="~30 sec" />
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            PizzaDAO builds infrastructure, not just tools for itself.
          </h2>
          <p className="mt-3 text-zinc-400 max-w-2xl">
            Pizza Token is intentionally generic. Any DAO that tracks attendance in
            Google Sheets and wants on-chain proof-of-participation can run this —
            no Solidity knowledge required, no new contract needed.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {REUSE_POINTS.map((p) => (
              <div key={p.heading} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <span className="text-3xl">{p.icon}</span>
                <h3 className="mt-3 text-sm font-semibold text-white">{p.heading}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>

          {/* setup steps */}
          <div className="mt-8">
            <p className="mb-4 text-sm font-semibold text-zinc-300">
              Another DAO can be up and running in 4 steps:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SETUP_STEPS.map((s, i) => (
                <div key={i} className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.action}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{s.detail}</p>
                    {s.code && (
                      <pre className="mt-2 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-orange-300 font-mono overflow-x-auto">
                        {s.code}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── section 6: cta ── */}
        <section className="rounded-2xl border border-orange-900/40 bg-orange-950/20 p-10 text-center" id="cta">
          <span className="text-5xl">🍕</span>
          <h2 className="mt-4 text-2xl font-bold">See it live.</h2>
          <p className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">
            Connect the admin wallet on Monad Testnet. Pick a call, drop the artwork,
            hit Send — the app reads the Google Sheet, creates the on-chain event, and
            batch-mints to every attendee wallet. Under 60 seconds, zero staff.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link
              href="/"
              className="rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
            >
              Open Admin Dashboard →
            </Link>
            <a
              href="https://testnet.monadexplorer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500"
            >
              Monad Explorer ↗
            </a>
          </div>
        </section>

      </main>

      {/* floating speaker notes -- toggle in bottom-right corner */}
      <SpeakerNotes />

      {/* footer */}
      <footer className="border-t border-zinc-800 mt-12 py-6 text-center">
        <p className="text-xs text-zinc-600 font-mono">
          Pizza Token · PizzaDAO · Monad Testnet · IPFS · Google Sheets · Next.js · wagmi · RainbowKit
        </p>
      </footer>

    </div>
  );
}

// ── architecture diagram ──────────────────────────────────────────────────
// svg-based flow: browser → (pinata/ipfs) + (monad contract)
// arrows are drawn as simple lines with marker-end arrowheads
function ArchDiagram() {
  return (
    <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <svg
        viewBox="0 0 760 340"
        className="w-full max-w-3xl mx-auto"
        aria-label="architecture diagram"
      >
        {/* arrowhead marker */}
        <defs>
          <marker
            id="arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="#71717a" />
          </marker>
          <marker
            id="arrow-orange"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="#ea580c" />
          </marker>
        </defs>

        {/* ── nodes ── */}

        {/* admin browser (centre-left) */}
        <Node x={30} y={120} w={160} h={80} borderColor="#ea580c" label="Admin Browser" sublabel="Next.js + wagmi + RainbowKit" icon="🖥️" />

        {/* metamask wallet (above browser) */}
        <Node x={30} y={20} w={160} h={60} borderColor="#f59e0b" label="MetaMask / Wallet" sublabel="signs txs, holds keys" icon="🦊" small />

        {/* pinata (top right) */}
        <Node x={310} y={20} w={180} h={70} borderColor="#3b82f6" label="Pinata API" sublabel="pinFileToIPFS endpoint" icon="📌" />

        {/* ipfs (below pinata) */}
        <Node x={540} y={20} w={180} h={70} borderColor="#06b6d4" label="IPFS Network" sublabel="permanent content-addressed storage" icon="🌐" small />

        {/* monad contract (bottom right) */}
        <Node x={310} y={220} w={180} h={80} borderColor="#a855f7" label="Monad Testnet" sublabel="PizzaPOAP.sol · ERC-721" icon="⛓️" />

        {/* attendee wallets */}
        <Node x={540} y={240} w={180} h={60} borderColor="#22c55e" label="Attendee Wallets" sublabel="receive ERC-721 token" icon="👛" small />

        {/* ── edges ── */}

        {/* browser ↔ wallet (vertical, up) */}
        <Arrow x1={110} y1={120} x2={110} y2={85} color="#f59e0b" label="sign tx" labelX={115} labelY={105} />

        {/* browser → pinata (horizontal) */}
        <Arrow x1={190} y1={145} x2={308} y2={60} color="#3b82f6" label="upload image" labelX={220} labelY={95} />

        {/* pinata → ipfs */}
        <Arrow x1={490} y1={55} x2={538} y2={55} color="#06b6d4" label="pin CID" labelX={497} labelY={48} />

        {/* ipfs → browser (return uri, curved down) */}
        <Arrow x1={630} y1={90} x2={195} y2={165} color="#06b6d4" label="ipfs:// URI" labelX={420} labelY={148} />

        {/* browser → monad */}
        <Arrow x1={190} y1={175} x2={308} y2={250} color="#ea580c" label="createEvent()" labelX={205} labelY={230} orange />

        {/* monad → attendees */}
        <Arrow x1={490} y1={265} x2={538} y2={265} color="#22c55e" label="mint()" labelX={497} labelY={258} />

        {/* dispense script label below monad */}
        <text x={350} y={320} fontSize={10} fill="#71717a" fontFamily="monospace">
          npm run dispense → batch mint to attendee list
        </text>
      </svg>
    </div>
  );
}

// svg box node
function Node({
  x, y, w, h, borderColor, label, sublabel, icon, small,
}: {
  x: number; y: number; w: number; h: number;
  borderColor: string; label: string; sublabel: string; icon: string; small?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} ry={8}
        fill="#18181b" stroke={borderColor} strokeWidth={1.5} />
      <text x={x + 10} y={y + (small ? 18 : 20)} fontSize={13} fill="#fff" fontWeight="600" fontFamily="sans-serif">
        {icon}  {label}
      </text>
      <text x={x + 10} y={y + (small ? 36 : 38)} fontSize={9} fill="#a1a1aa" fontFamily="sans-serif">
        {sublabel}
      </text>
    </g>
  );
}

// svg directed edge with a small label
function Arrow({
  x1, y1, x2, y2, color, label, labelX, labelY, orange,
}: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; label: string; labelX: number; labelY: number; orange?: boolean;
}) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={1.5}
        markerEnd={orange ? "url(#arrow-orange)" : "url(#arrow)"}
        strokeDasharray={orange ? "0" : "4 3"}
      />
      <text x={labelX} y={labelY} fontSize={9} fill={color} fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}

// small labelled section header with a time budget indicator
function SectionLabel({
  number,
  label,
  time,
}: {
  number: string;
  label: string;
  time: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs font-bold text-zinc-600">{number}</span>
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
        {label}
      </span>
      <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-500">
        {time}
      </span>
    </div>
  );
}

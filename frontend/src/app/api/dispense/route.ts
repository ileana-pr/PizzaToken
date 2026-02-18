// next.js api route: GET + POST /api/dispense
//
// GET  → reads the master sheet and returns ALL calls as a list for the ui picker
// POST → full flow for one call: create on-chain event → mint tokens → mark sheet done
//
// the master sheet has: A=Date  B=Link (sheet url or name)  C=Attendance count
// each row represents one weekly pizza dao community call

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { ethers } from "ethers";

// -------------------------------------------------------
// types
// -------------------------------------------------------

// one row from the master sheet -- returned by GET
export interface CallRow {
  date: string;       // raw date string from col A (e.g. "2/15/2026")
  sheetId: string | null; // extracted from the url in col B, null if no url
  link: string;       // raw value from col B (url or text name)
  attendanceCount: number; // from col C
  masterRow: number;  // 1-based row index in the master sheet
}

// shape of the attendance sheet cross-reference result
interface AttendeeRow {
  name: string;
  discordId: string;
  walletAddress: string;
  row: number;
}

// -------------------------------------------------------
// column layout
// -------------------------------------------------------

const MASTER_COL  = { DATE: 0, LINK: 1, COUNT: 2 };
const ATTEND_COL  = { NAME: 1, DISCORD_ID: 2, MINTED: 6 };
const CREW_COL    = { DISCORD_ID: 12, WALLET: 13 };

// -------------------------------------------------------
// retry helper -- wraps any async fn with exponential backoff
// catches rpc rate-limit errors and waits before retrying
// -------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 5,
  baseDelayMs = 3000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      const isRateLimit =
        msg.includes("request limit") ||
        msg.includes("rate limit") ||
        msg.includes("-32007") ||
        msg.includes("coalesce");

      if (isRateLimit && attempt < maxAttempts) {
        const delay = baseDelayMs * attempt;
        console.log(`  rpc issue on "${label}", retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`"${label}" failed after ${maxAttempts} attempts`);
}

// abi -- both createEvent and batchMint needed for the full flow
const PIZZA_POAP_ABI = [
  "function createEvent(string name, string description, string imageURI, uint256 eventDate) returns (uint256)",
  "function batchMint(uint256 eventId, address[] attendees) returns (uint256)",
  "event EventCreated(uint256 indexed eventId, string name, uint256 eventDate)",
  "event AttendanceMinted(uint256 indexed eventId, address indexed attendee, uint256 tokenId)",
];

// -------------------------------------------------------
// google auth
// -------------------------------------------------------

function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("missing google credentials in .env.local");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// -------------------------------------------------------
// extract google sheet id from a full url
// e.g. https://docs.google.com/spreadsheets/d/SHEET_ID/edit -> SHEET_ID
// -------------------------------------------------------

function extractSheetId(raw: string): string | null {
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// -------------------------------------------------------
// read the full master sheet and return all rows
//
// uses spreadsheets.get with includeGridData:true so we can read the
// cell.hyperlink property -- the newer rows store the sheet url as a
// hyperlink behind display text (e.g. "PizzaDAO Attendance 2026-01-04")
// while the older rows have the raw url as plain text in the cell.
// both cases are handled: hyperlink takes priority, plain text is the fallback.
// -------------------------------------------------------

async function readMasterSheet(): Promise<CallRow[]> {
  const masterSheetId = process.env.MASTER_SHEET_ID;
  const masterTabName = process.env.MASTER_SHEET_TAB_NAME || "Sheet1";
  if (!masterSheetId) throw new Error("missing MASTER_SHEET_ID in .env.local");

  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // includeGridData gives us full cell objects including the hyperlink field
  const res = await sheets.spreadsheets.get({
    spreadsheetId:   masterSheetId,
    ranges:          [`${masterTabName}!A:C`],
    includeGridData: true,
  });

  const rowData = res.data.sheets?.[0]?.data?.[0]?.rowData;
  if (!rowData || rowData.length <= 1) return [];

  const calls: CallRow[] = [];

  // skip header row (index 0)
  for (let i = 1; i < rowData.length; i++) {
    const cells     = rowData[i].values;
    if (!cells) continue;

    const dateCell  = cells[MASTER_COL.DATE];
    const linkCell  = cells[MASTER_COL.LINK];
    const countCell = cells[MASTER_COL.COUNT];

    const date  = (dateCell?.formattedValue || "").trim();
    if (!date) continue;

    // hyperlink is set when the cell has a clickable link behind display text
    // formattedValue is the fallback for cells that contain a plain url string
    const link  = (linkCell?.hyperlink || linkCell?.formattedValue || "").trim();
    const count = parseInt((countCell?.formattedValue || "0"), 10) || 0;

    calls.push({
      date,
      sheetId:         extractSheetId(link), // null if we still can't find a url
      link,
      attendanceCount: count,
      masterRow:       i + 1, // sheets are 1-indexed
    });
  }

  // return newest first (reverse chronological)
  return calls.reverse();
}

// -------------------------------------------------------
// build discord id -> wallet map from crew sheet
// -------------------------------------------------------

async function buildWalletMap(
  crewSheetId: string,
  crewTabName: string
): Promise<Map<string, string>> {
  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: crewSheetId,
    range: `${crewTabName}!A:N`,
  });

  const rows = res.data.values;
  if (!rows || rows.length <= 1) return new Map();

  const map = new Map<string, string>();
  for (let i = 1; i < rows.length; i++) {
    const row       = rows[i];
    const discordId = (row[CREW_COL.DISCORD_ID] || "").toString().trim();
    const wallet    = (row[CREW_COL.WALLET]      || "").trim();
    if (!discordId || !wallet) continue;
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) continue;
    map.set(discordId, wallet);
  }
  return map;
}

// -------------------------------------------------------
// read the attendance sheet and cross-reference wallets
// -------------------------------------------------------

async function readAttendees(
  attendanceSheetId: string,
  attendanceTabName: string
): Promise<{ attendees: AttendeeRow[]; noWalletCount: number; alreadyMintedCount: number }> {
  const crewSheetId = process.env.CREW_SHEET_ID;
  const crewTabName = process.env.CREW_TAB_NAME || "Sheet1";
  if (!crewSheetId) throw new Error("missing CREW_SHEET_ID in .env.local");

  const walletMap = await buildWalletMap(crewSheetId, crewTabName);

  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId: attendanceSheetId,
      range: `${attendanceTabName}!A:G`,
    });
  } catch (err: unknown) {
    // google returns 403 when the service account hasn't been granted access
    const isPermission =
      err instanceof Error &&
      (err.message.includes("permission") || err.message.includes("403"));

    if (isPermission) {
      const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "the service account";
      throw new Error(
        `The attendance sheet hasn't been shared with the service account yet.\n\n` +
        `Share it with: ${serviceEmail}\n\n` +
        `In Google Sheets: Share → paste the email above → Viewer → Send.`
      );
    }
    throw err;
  }

  const rows = res.data.values;
  if (!rows || rows.length <= 1) {
    return { attendees: [], noWalletCount: 0, alreadyMintedCount: 0 };
  }

  const attendees: AttendeeRow[] = [];
  let noWalletCount     = 0;
  let alreadyMintedCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row       = rows[i];
    const name      = (row[ATTEND_COL.NAME]       || "").trim();
    const discordId = (row[ATTEND_COL.DISCORD_ID] || "").toString().trim();
    const minted    = (row[ATTEND_COL.MINTED]     || "").toLowerCase().trim();

    if (!name || !discordId) continue;
    if (minted === "yes") { alreadyMintedCount++; continue; }

    const wallet = walletMap.get(discordId);
    if (!wallet) { noWalletCount++; continue; }

    attendees.push({ name, discordId, walletAddress: wallet, row: i + 1 });
  }

  return { attendees, noWalletCount, alreadyMintedCount };
}

// -------------------------------------------------------
// create event on-chain using the deployer key
// the event name is always "Pizza DAO Community Call - {date}"
// -------------------------------------------------------

async function createOnChainEvent(
  date: string,
  imageUri: string
): Promise<number> {
  const network         = process.env.MONAD_NETWORK;
  const rpcUrl          = network === "mainnet"
    ? process.env.MONAD_MAINNET_RPC || "https://rpc.monad.xyz"
    : process.env.MONAD_TESTNET_RPC || "https://testnet-rpc.monad.xyz";
  const privateKey      = process.env.DEPLOYER_PRIVATE_KEY;
  const contractAddress = process.env.PIZZA_POAP_CONTRACT;

  if (!privateKey)      throw new Error("missing DEPLOYER_PRIVATE_KEY in .env.local");
  if (!contractAddress) throw new Error("missing PIZZA_POAP_CONTRACT in .env.local");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, PIZZA_POAP_ABI, signer);

  // auto-generate name and description from the date
  const name        = `Pizza DAO Community Call - ${date}`;
  const description = "PizzaDAO weekly community call attendance token";

  // parse the date string to a unix timestamp
  // handles formats like "2/15/2026", "12/28/2025"
  const eventDate = Math.floor(new Date(date).getTime() / 1000);

  const tx = await withRetry(
    () => contract.createEvent(name, description, imageUri, BigInt(eventDate)),
    "createEvent send"
  );
  const receipt = await withRetry(
    () => tx.wait(),
    "createEvent confirm"
  ) as { logs: ethers.Log[]; hash: string };

  // find the EventCreated log to get the new event id
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "EventCreated") {
        return Number(parsed.args[0]);
      }
    } catch { /* not this log */ }
  }

  throw new Error("EventCreated log not found -- event may not have been created");
}

// -------------------------------------------------------
// batch mint on monad
// -------------------------------------------------------

async function batchMint(
  eventId: number,
  walletAddresses: string[]
): Promise<{ txHash: string; mintedCount: number; skippedCount: number }> {
  const network         = process.env.MONAD_NETWORK;
  const rpcUrl          = network === "mainnet"
    ? process.env.MONAD_MAINNET_RPC || "https://rpc.monad.xyz"
    : process.env.MONAD_TESTNET_RPC || "https://testnet-rpc.monad.xyz";
  const privateKey      = process.env.DEPLOYER_PRIVATE_KEY;
  const contractAddress = process.env.PIZZA_POAP_CONTRACT;

  if (!privateKey)      throw new Error("missing DEPLOYER_PRIVATE_KEY in .env.local");
  if (!contractAddress) throw new Error("missing PIZZA_POAP_CONTRACT in .env.local");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer   = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, PIZZA_POAP_ABI, signer);

  const tx = await withRetry(
    () => contract.batchMint(eventId, walletAddresses),
    "batchMint send"
  );
  const receipt = await withRetry(
    () => tx.wait(),
    "batchMint confirm",
    8,    // more attempts for confirmation -- testnet can be slow
    4000  // longer base delay
  ) as { logs: ethers.Log[]; hash: string };

  const mintedLogs = receipt.logs.filter((l: ethers.Log) => {
    try { return contract.interface.parseLog(l)?.name === "AttendanceMinted"; }
    catch { return false; }
  });

  return {
    txHash:       receipt.hash,
    mintedCount:  mintedLogs.length,
    skippedCount: walletAddresses.length - mintedLogs.length,
  };
}

// -------------------------------------------------------
// mark rows as minted in column G of the attendance sheet
// -------------------------------------------------------

async function markAsMinted(
  attendanceSheetId: string,
  rowNumbers: number[],
  attendanceTabName: string
): Promise<void> {
  if (rowNumbers.length === 0) return;

  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const data = rowNumbers.map((row) => ({
    range: `${attendanceTabName}!G${row}`,
    values: [["yes"]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: attendanceSheetId,
    requestBody: { valueInputOption: "RAW", data },
  });
}

// -------------------------------------------------------
// GET /api/dispense
// returns all calls from the master sheet for the ui picker
// newest first, each row tells us: date, sheetId (if url exists), attendance count
// -------------------------------------------------------

export async function GET() {
  try {
    const calls = await readMasterSheet();
    return NextResponse.json({ calls });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unexpected error";
    console.error("dispense GET error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// -------------------------------------------------------
// POST /api/dispense
// body: { sheetId: string, date: string, imageUri: string }
//
// full flow:
//   1. create the event on-chain (deployer key signs, no wallet needed)
//   2. read attendees from the attendance sheet
//   3. batch mint tokens to matched wallets
//   4. write "yes" to column G for all minted rows
// -------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sheetId, date, imageUri } = body as {
      sheetId: string;
      date: string;
      imageUri: string;
    };

    if (!sheetId)   return NextResponse.json({ success: false, error: "sheetId is required" }, { status: 400 });
    if (!date)      return NextResponse.json({ success: false, error: "date is required" }, { status: 400 });
    if (!imageUri)  return NextResponse.json({ success: false, error: "imageUri is required" }, { status: 400 });

    const attendanceTabName = process.env.ATTENDANCE_TAB_NAME || "Sheet1";

    // step 1: create the on-chain event
    const eventId = await createOnChainEvent(date, imageUri);

    // step 2: read attendance sheet + cross-reference wallets
    const { attendees, noWalletCount, alreadyMintedCount } = await readAttendees(
      sheetId,
      attendanceTabName
    );

    if (attendees.length === 0) {
      return NextResponse.json({
        success: true,
        eventId,
        date,
        mintedCount: 0,
        skippedCount: 0,
        noWalletCount,
        alreadyMintedCount,
        attendees: [],
      });
    }

    // step 3: mint tokens
    const wallets    = attendees.map((a) => a.walletAddress);
    const mintResult = await batchMint(eventId, wallets);

    // step 4: mark rows done in the attendance sheet
    await markAsMinted(sheetId, attendees.map((a) => a.row), attendanceTabName);

    return NextResponse.json({
      success: true,
      eventId,
      date,
      mintedCount:       mintResult.mintedCount,
      skippedCount:      mintResult.skippedCount,
      noWalletCount,
      alreadyMintedCount,
      txHash:            mintResult.txHash,
      attendees:         attendees.map((a) => ({ name: a.name, wallet: a.walletAddress })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unexpected error";
    console.error("dispense POST error:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

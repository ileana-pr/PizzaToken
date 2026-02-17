import { google } from "googleapis";
import "dotenv/config";

// represents a matched attendee ready for minting
export interface AttendeeRow {
  name: string;         // display name from attendance sheet
  discordId: string;    // numeric discord id (the join key between sheets)
  walletAddress: string;
  row: number;          // 1-based row in the attendance sheet (for marking minted)
}

// column layout for the attendance sheet (per-call, e.g. "2026-02-15")
// A: Timestamp | B: Name | C: Discord ID | D: Joined | E: Left | F: Notes | G: Minted
const ATTEND_COL = {
  TIMESTAMP: 0,
  NAME: 1,
  DISCORD_ID: 2,
  JOINED: 3,
  LEFT: 4,
  NOTES: 5,
  MINTED: 6, // we write "yes" here after minting (column G)
};

// column layout for the crew sheet ("PizzaDAO Crew")
// column M (index 12): Discord ID | column N (index 13): Wallet Address
const CREW_COL = {
  DISCORD_ID: 12, // column M
  WALLET: 13,     // column N
};

// authenticate with google sheets using a service account
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in .env"
    );
  }

  return new google.auth.JWT(email, undefined, key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

// build a lookup map: discord id => wallet address from the crew sheet
async function buildWalletMap(
  crewSheetId: string,
  crewTabName: string
): Promise<Map<string, string>> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // read columns M and N (discord id + wallet)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: crewSheetId,
    range: `${crewTabName}!A:N`,
  });

  const rows = res.data.values;
  if (!rows || rows.length <= 1) {
    console.log("no data found in crew sheet");
    return new Map();
  }

  const walletMap = new Map<string, string>();

  // skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const discordId = (row[CREW_COL.DISCORD_ID] || "").toString().trim();
    const wallet = (row[CREW_COL.WALLET] || "").trim();

    if (!discordId || !wallet) continue;

    // validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) continue;

    walletMap.set(discordId, wallet);
  }

  console.log(`crew sheet: loaded ${walletMap.size} discord-to-wallet mappings`);
  return walletMap;
}

/// read the attendance sheet, cross-reference with crew sheet to get wallets,
/// and return only attendees who haven't been minted yet
export async function readAttendees(
  attendanceSheetId: string,
  crewSheetId: string,
  attendanceTabName: string = "Sheet1",
  crewTabName: string = "Sheet1"
): Promise<AttendeeRow[]> {
  // step 1: build the discord id => wallet lookup from crew sheet
  const walletMap = await buildWalletMap(crewSheetId, crewTabName);

  if (walletMap.size === 0) {
    console.warn("warning: no wallet mappings found in crew sheet");
    return [];
  }

  // step 2: read the attendance sheet
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: attendanceSheetId,
    range: `${attendanceTabName}!A:G`,
  });

  const rows = res.data.values;
  if (!rows || rows.length <= 1) {
    console.log("no data rows found in attendance sheet");
    return [];
  }

  const attendees: AttendeeRow[] = [];
  let noWallet = 0;
  let alreadyMinted = 0;

  // skip header row (index 0), data starts at index 1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = (row[ATTEND_COL.NAME] || "").trim();
    const discordId = (row[ATTEND_COL.DISCORD_ID] || "").toString().trim();
    const minted = (row[ATTEND_COL.MINTED] || "").toLowerCase().trim();

    // skip empty rows
    if (!name || !discordId) continue;

    // skip already minted
    if (minted === "yes") {
      alreadyMinted++;
      continue;
    }

    // look up wallet from crew sheet
    const wallet = walletMap.get(discordId);
    if (!wallet) {
      console.warn(`  no wallet found for ${name} (discord id: ${discordId})`);
      noWallet++;
      continue;
    }

    attendees.push({
      name,
      discordId,
      walletAddress: wallet,
      row: i + 1, // sheets are 1-indexed, +1 for header
    });
  }

  console.log(
    `\nattendance summary: ${attendees.length} to mint, ${alreadyMinted} already minted, ${noWallet} missing wallets`
  );

  return attendees;
}

/// mark rows as minted in column G of the attendance sheet
export async function markAsMinted(
  attendanceSheetId: string,
  rowNumbers: number[],
  attendanceTabName: string = "Sheet1"
): Promise<void> {
  if (rowNumbers.length === 0) return;

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // batch update: set column G to "yes" for each minted row
  const data = rowNumbers.map((row) => ({
    range: `${attendanceTabName}!G${row}`,
    values: [["yes"]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: attendanceSheetId,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });

  console.log(`marked ${rowNumbers.length} rows as minted in attendance sheet`);
}

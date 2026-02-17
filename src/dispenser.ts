import "dotenv/config";
import { readAttendees, markAsMinted } from "./sheets";
import { MonadMintProvider } from "./providers";

// -------------------------------------------------------
// config from environment
// -------------------------------------------------------

const ATTENDANCE_SHEET_ID = process.env.ATTENDANCE_SHEET_ID;
const ATTENDANCE_TAB_NAME = process.env.ATTENDANCE_TAB_NAME || "Sheet1";
const CREW_SHEET_ID = process.env.CREW_SHEET_ID;
const CREW_TAB_NAME = process.env.CREW_TAB_NAME || "Sheet1";
const EVENT_ID = process.env.DISPENSE_EVENT_ID;

// -------------------------------------------------------
// main dispenser logic
// -------------------------------------------------------

async function dispense() {
  console.log("=== pizza poap dispenser ===\n");

  // validate config
  if (!ATTENDANCE_SHEET_ID) {
    throw new Error("missing ATTENDANCE_SHEET_ID in .env");
  }
  if (!CREW_SHEET_ID) {
    throw new Error("missing CREW_SHEET_ID in .env");
  }
  if (!EVENT_ID) {
    throw new Error(
      "missing DISPENSE_EVENT_ID in .env -- set this to the event id you want to mint for"
    );
  }

  const eventId = parseInt(EVENT_ID, 10);
  if (isNaN(eventId)) {
    throw new Error("DISPENSE_EVENT_ID must be a number");
  }

  // step 1: initialize the mint provider
  // swap MonadMintProvider for POAPMintProvider here when poap supports monad
  const provider = new MonadMintProvider();
  console.log(`mint provider: ${provider.name}\n`);

  // step 2: read attendance + cross-reference with crew sheet for wallets
  console.log("reading attendance and looking up wallets...");
  const attendees = await readAttendees(
    ATTENDANCE_SHEET_ID,
    CREW_SHEET_ID,
    ATTENDANCE_TAB_NAME,
    CREW_TAB_NAME
  );

  if (attendees.length === 0) {
    console.log("\nno un-minted attendees with wallets found. nothing to do.");
    return;
  }

  console.log(`\n${attendees.length} attendees ready to mint:\n`);
  for (const a of attendees) {
    console.log(`  ${a.name} => ${a.walletAddress}`);
  }
  console.log("");

  // step 3: batch mint (small delay to let rpc rate limit window reset after sheets reads)
  console.log("preparing to mint...\n");
  await new Promise((r) => setTimeout(r, 2000));

  const wallets = attendees.map((a) => a.walletAddress);
  const result = await provider.batchMint(eventId, wallets);

  if (!result.success) {
    console.error(`\nminting failed: ${result.error}`);
    process.exit(1);
  }

  console.log(
    `\nmint result: ${result.mintedCount} minted, ${result.skippedCount} skipped`
  );

  if (result.txHash) {
    console.log(`transaction: ${result.txHash}`);
  }

  // step 4: mark minted rows in the attendance sheet
  // mark all attendees we attempted (skipped = already minted on-chain = still done)
  if (result.success) {
    console.log("\nmarking minted rows in attendance sheet...");
    const rowNumbers = attendees.map((a) => a.row);
    await markAsMinted(ATTENDANCE_SHEET_ID, rowNumbers, ATTENDANCE_TAB_NAME);
  }

  console.log("\ndone!");
}

// -------------------------------------------------------
// run
// -------------------------------------------------------

dispense().catch((err) => {
  console.error("dispenser error:", err.message);
  process.exit(1);
});

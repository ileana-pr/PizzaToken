import "dotenv/config";
import { readAttendees } from "./sheets";

// full end-to-end test: read attendance, cross-reference with crew, show matched wallets

async function test() {
  const attendanceId = process.env.ATTENDANCE_SHEET_ID!;
  const crewId = process.env.CREW_SHEET_ID!;
  const attendanceTab = process.env.ATTENDANCE_TAB_NAME || "Sheet1";
  const crewTab = process.env.CREW_TAB_NAME || "Sheet1";

  console.log("=== pizza poap sheets test ===\n");

  const attendees = await readAttendees(attendanceId, crewId, attendanceTab, crewTab);

  console.log(`\n--- matched attendees (${attendees.length}) ---\n`);
  for (const a of attendees) {
    console.log(`  ${a.name} => ${a.walletAddress}`);
  }

  if (attendees.length === 0) {
    console.log("  (none matched -- attendees may not have wallets in crew sheet)");
  }
}

test().catch((err) => {
  console.error("test failed:", err.message);
  process.exit(1);
});

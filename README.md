# Pizza POAP - Automatic Attendance NFT Dispenser

Automated POAP-like attendance tokens for Pizza DAO community calls, minted on Monad chain.

## Problem

- POAPs are distributed manually by dropping links in chat
- Attendees miss the drop, farmers grab tokens
- Small team of unpaid staff doing repetitive work

## Solution

Soulbound ERC-721 tokens auto-minted to attendees based on Discord voice channel attendance.

```
Discord Bot -> Google Sheet -> This Backend -> Monad Smart Contract -> NFT in wallet
```

No link dropping. No clicking. No farming (tokens are non-transferable).

## Architecture

```
┌──────────────┐     ┌──────────────┐
│  Discord Bot │────>│  Attendance  │──┐
│  (existing)  │     │    Sheet     │  │  ┌──────────────┐     ┌──────────────┐
└──────────────┘     └──────────────┘  ├─>│   Dispenser  │────>│ Monad Chain  │
                     ┌──────────────┐  │  │  (this repo) │     │ PizzaPOAP.sol│
                     │  Crew Sheet  │──┘  └──────────────┘     └──────────────┘
                     │  (wallets)   │                                 │
                     └──────────────┘                          NFT arrives in
                                                              attendee wallets
```

**Two-sheet lookup:** The Discord bot writes attendance (name + Discord ID) to a per-call
sheet. The crew sheet maps Discord IDs to wallet addresses. The dispenser joins them.

The backend uses a **MintProvider interface** so the minting layer can be swapped:
- `MonadMintProvider` -- calls our custom contract (current)
- `POAPMintProvider` -- stub for official POAP API (future, when POAP supports Monad)

## Smart Contract Features

- **Soulbound** -- tokens cannot be transferred, preventing farming
- **Batch minting** -- mint to 50+ wallets in a single transaction
- **Duplicate prevention** -- same wallet can't claim twice for the same event
- **On-chain metadata** -- tokenURI returns base64 JSON, no external server needed
- **Event management** -- create/deactivate events as an admin

## Setup

### Prerequisites

- Node.js v20+
- A wallet with MON for gas (testnet or mainnet)
- A Google Cloud service account with Sheets API access

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|----------|-------------|
| `DEPLOYER_PRIVATE_KEY` | Wallet private key (pays gas, owns the contract) |
| `MONAD_TESTNET_RPC` | Monad testnet RPC URL |
| `PIZZA_POAP_CONTRACT` | Contract address (after deployment) |
| `ATTENDANCE_SHEET_ID` | Google Sheet ID for the per-call attendance sheet |
| `ATTENDANCE_TAB_NAME` | Tab/sheet name within the attendance spreadsheet |
| `CREW_SHEET_ID` | Google Sheet ID for the PizzaDAO Crew sheet (has wallets) |
| `CREW_TAB_NAME` | Tab/sheet name within the crew spreadsheet |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email |
| `GOOGLE_PRIVATE_KEY` | Service account private key |
| `DISPENSE_EVENT_ID` | Event ID to mint for (set before each run) |

The sheet ID is the long string in the Google Sheets URL: `docs.google.com/spreadsheets/d/{THIS_PART}/edit`

### 3. Deploy the contract

```bash
# testnet
npm run deploy:testnet

# mainnet (when ready)
npm run deploy:mainnet
```

Copy the deployed address into `.env` as `PIZZA_POAP_CONTRACT`.

### 4. Google Sheet format

**Attendance Sheet** (per-call, written by Discord bot):

| A: Timestamp | B: Name | C: Discord ID | D: Joined | E: Left | F: Notes | G: Minted |
|---|---|---|---|---|---|---|
| 2/15/2026 | Enzo Pepperoni | 403065718914154516 | | | Channel: Pizza Hacking Radio | |

- Columns A-F are written by the Discord bot (already done)
- Column G is left blank -- the dispenser writes "yes" here after minting

**Crew Sheet** ("PizzaDAO Crew" with member wallets):

| ... | M: Discord ID | N: Wallet Address |
|---|---|---|
| ... | 403065718914154516 | 0xABC...123 |

- Column M: numeric Discord ID (the join key)
- Column N: Ethereum-compatible wallet address (0x...)

### 5. Run the dispenser

```bash
# set the event id in .env first, then:
npm run dispense
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile the Solidity contract |
| `npm run test` | Run the contract test suite |
| `npm run deploy:testnet` | Deploy to Monad testnet |
| `npm run deploy:mainnet` | Deploy to Monad mainnet |
| `npm run dispense` | Read sheet and mint tokens |

## Project Structure

```
pizzapoap/
├── contracts/
│   └── PizzaPOAP.sol          # soulbound ERC-721 contract
├── scripts/
│   └── deploy.ts              # deployment script
├── src/
│   ├── dispenser.ts           # main entry point
│   ├── sheets.ts              # google sheets reader/writer
│   └── providers/
│       ├── types.ts           # MintProvider interface
│       ├── monad.ts           # Monad contract provider
│       ├── poap-stub.ts       # future official POAP provider
│       └── index.ts           # barrel exports
├── test/
│   └── PizzaPOAP.test.ts      # contract tests (14 tests)
├── hardhat.config.ts
├── package.json
└── .env.example
```

## Future: Official POAP Integration

This project is designed as a demo to pitch to the POAP team for official Monad support. When approved:

1. Implement `POAPMintProvider` in `src/providers/poap-stub.ts`
2. Swap the provider in `src/dispenser.ts`
3. The rest of the pipeline stays the same

## License

MIT

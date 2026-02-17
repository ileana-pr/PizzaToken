import { ethers } from "ethers";
import { MintProvider, MintResult } from "./types";
import "dotenv/config";

// helper: sleep for ms
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// helper: retry a function with exponential backoff for rpc rate limits
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 5,
  baseDelay = 3000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit = err.message?.includes("request limit");
      if (isRateLimit && attempt < maxAttempts) {
        const delay = baseDelay * attempt;
        console.log(
          `  rpc rate limited on ${label}, waiting ${delay / 1000}s... (attempt ${attempt}/${maxAttempts})`
        );
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts`);
}

// abi subset -- only the functions we call from the backend
const PIZZA_POAP_ABI = [
  "function createEvent(string name, string description, string imageURI, uint256 eventDate) returns (uint256)",
  "function batchMint(uint256 eventId, address[] attendees) returns (uint256)",
  "function totalEvents() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "event EventCreated(uint256 indexed eventId, string name, uint256 eventDate)",
  "event AttendanceMinted(uint256 indexed eventId, address indexed attendee, uint256 tokenId)",
];

export class MonadMintProvider implements MintProvider {
  readonly name = "Monad (PizzaPOAP Contract)";

  private contract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor() {
    // require explicit network selection -- never silently fall through to mainnet
    const network = process.env.MONAD_NETWORK;
    if (!network || !["testnet", "mainnet"].includes(network)) {
      throw new Error(
        'MONAD_NETWORK must be set to "testnet" or "mainnet" in .env'
      );
    }

    const rpcUrl =
      network === "mainnet"
        ? process.env.MONAD_MAINNET_RPC || "https://rpc.monad.xyz"
        : process.env.MONAD_TESTNET_RPC || "https://testnet-rpc.monad.xyz";

    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("missing DEPLOYER_PRIVATE_KEY in .env");
    }

    const contractAddress = process.env.PIZZA_POAP_CONTRACT;
    if (!contractAddress) {
      throw new Error("missing PIZZA_POAP_CONTRACT in .env");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, provider);
    this.contract = new ethers.Contract(
      contractAddress,
      PIZZA_POAP_ABI,
      this.signer
    );

    console.log(`monad provider initialized (${network})`);
    console.log(`  rpc:      ${rpcUrl}`);
    console.log(`  contract: ${contractAddress}`);
    console.log(`  signer:   ${this.signer.address}`);
  }

  async createEvent(
    name: string,
    description: string,
    imageURI: string,
    eventDate: number
  ): Promise<number> {
    console.log(`creating event: "${name}"`);

    const tx = await withRetry(
      () => this.contract.createEvent(name, description, imageURI, eventDate),
      "createEvent send"
    );
    const receipt: any = await withRetry(() => tx.wait(), "createEvent receipt");

    const log = receipt.logs.find((l: ethers.Log) => {
      try {
        return this.contract.interface.parseLog(l)?.name === "EventCreated";
      } catch {
        return false;
      }
    });

    if (!log) {
      throw new Error("EventCreated log not found in transaction receipt");
    }

    const parsed = this.contract.interface.parseLog(log);
    const eventId = Number(parsed!.args[0]);

    console.log(`event created: id=${eventId}, tx=${receipt.hash}`);
    return eventId;
  }

  async batchMint(
    eventId: number,
    walletAddresses: string[]
  ): Promise<MintResult> {
    if (walletAddresses.length === 0) {
      return { success: true, mintedCount: 0, skippedCount: 0 };
    }

    console.log(
      `batch minting ${walletAddresses.length} tokens for event ${eventId}...`
    );

    try {
      // send the transaction with retry
      const tx = await withRetry(
        () => this.contract.batchMint(eventId, walletAddresses),
        "batchMint send"
      );
      console.log(`tx sent: ${tx.hash}, waiting for confirmation...`);

      // wait for receipt with retry
      const receipt: any = await withRetry(
        () => tx.wait(),
        "batchMint receipt",
        8,
        4000
      );

      // count AttendanceMinted events to know how many actually minted
      const mintedLogs = receipt.logs.filter((l: ethers.Log) => {
        try {
          return (
            this.contract.interface.parseLog(l)?.name === "AttendanceMinted"
          );
        } catch {
          return false;
        }
      });

      const mintedCount = mintedLogs.length;
      const skippedCount = walletAddresses.length - mintedCount;

      console.log(
        `batch mint complete: ${mintedCount} minted, ${skippedCount} skipped (duplicates/zero), tx=${receipt.hash}`
      );

      return {
        success: true,
        txHash: receipt.hash,
        mintedCount,
        skippedCount,
      };
    } catch (err: any) {
      console.error("batch mint failed:", err.message);
      return {
        success: false,
        mintedCount: 0,
        skippedCount: walletAddresses.length,
        error: err.message,
      };
    }
  }
}

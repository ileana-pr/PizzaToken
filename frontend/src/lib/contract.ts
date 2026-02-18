// pizzapoap contract config for the frontend
// parseAbi converts human-readable strings into the json abi objects viem needs
// using raw strings causes "Cannot use 'in' operator" errors at runtime

import { parseAbi } from "viem";

export const PIZZA_POAP_ABI = parseAbi([
  // read
  "function owner() view returns (address)",
  "function totalEvents() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function events(uint256 eventId) view returns (string name, string description, string imageURI, uint256 eventDate, uint256 mintCount, bool active)",
  // write (owner only)
  "function createEvent(string name, string description, string imageURI, uint256 eventDate) returns (uint256)",
  "function setEventActive(uint256 eventId, bool active)",
]);

// contract address comes from the environment variable
// set NEXT_PUBLIC_PIZZA_POAP_CONTRACT in frontend/.env.local
export const PIZZA_POAP_ADDRESS = (process.env.NEXT_PUBLIC_PIZZA_POAP_CONTRACT ||
  "") as `0x${string}`;

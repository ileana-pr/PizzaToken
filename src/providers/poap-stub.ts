import { MintProvider, MintResult } from "./types";

// placeholder for future official poap api integration.
// when poap adds monad support, implement this class to call
// their api instead of our custom contract.
//
// swap in by changing the provider in dispenser.ts:
//   const provider = new POAPMintProvider();

export class POAPMintProvider implements MintProvider {
  readonly name = "Official POAP API (not yet implemented)";

  async createEvent(
    _name: string,
    _description: string,
    _imageURI: string,
    _eventDate: number
  ): Promise<number> {
    // future: POST /events to https://api.poap.tech
    throw new Error(
      "POAPMintProvider not implemented yet. waiting for poap to support monad."
    );
  }

  async batchMint(
    _eventId: number,
    _walletAddresses: string[]
  ): Promise<MintResult> {
    // future: POST /actions/claim-qr for each attendee
    throw new Error(
      "POAPMintProvider not implemented yet. waiting for poap to support monad."
    );
  }
}

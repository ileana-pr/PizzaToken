// mint provider interface -- the abstraction layer that lets us swap
// between our custom monad contract and the official poap api later.
// think of it like a usb port: the cable (provider) can change,
// but the plug (interface) stays the same.

export interface MintResult {
  success: boolean;
  txHash?: string;
  mintedCount: number;
  skippedCount: number;
  error?: string;
}

export interface MintProvider {
  // human-readable name for logging
  readonly name: string;

  // create a new event/drop and return its id
  createEvent(
    name: string,
    description: string,
    imageURI: string,
    eventDate: number
  ): Promise<number>;

  // mint attendance tokens to a list of wallet addresses for a given event
  batchMint(eventId: number, walletAddresses: string[]): Promise<MintResult>;
}

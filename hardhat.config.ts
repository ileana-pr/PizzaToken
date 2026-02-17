import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // local hardhat network used by default for tests
    hardhat: {},
    // monad testnet
    monadTestnet: {
      url: process.env.MONAD_TESTNET_RPC || "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: [PRIVATE_KEY],
    },
    // monad mainnet
    monadMainnet: {
      url: process.env.MONAD_MAINNET_RPC || "https://rpc.monad.xyz",
      chainId: 143,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("deploying PizzaPOAP with account:", deployer.address);
  console.log(
    "account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "MON"
  );

  const factory = await ethers.getContractFactory("PizzaPOAP");
  const pizzaPoap = await factory.deploy();

  await pizzaPoap.waitForDeployment();

  const address = await pizzaPoap.getAddress();
  console.log("PizzaPOAP deployed to:", address);
  console.log("");
  console.log("next steps:");
  console.log(`  1. copy the address above into your .env as PIZZA_POAP_CONTRACT=${address}`);
  console.log("  2. create your first event via the contract or the dispenser script");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { ethers } from "hardhat";

async function main() {
  const contractAddress = process.env.PIZZA_POAP_CONTRACT;
  if (!contractAddress) {
    throw new Error("missing PIZZA_POAP_CONTRACT in .env");
  }

  const [deployer] = await ethers.getSigners();
  const pizzaPoap = await ethers.getContractAt("PizzaPOAP", contractAddress, deployer);

  // event details for the feb 15 2026 community call
  const name = "Pizza DAO Call - Feb 15 2026";
  const description = "Pizza Hacking Radio - Weekly community call attendance token";
  const imageURI = "ipfs://bafybeifzhrenxyrnzemr5qi2ew2okusujtqjadc6wyc5j6bzbmoydxdyc4";
  const eventDate = Math.floor(new Date("2026-02-15").getTime() / 1000);

  console.log("creating event on PizzaPOAP contract...");
  console.log(`  name:  ${name}`);
  console.log(`  image: ${imageURI}`);
  console.log(`  date:  ${new Date(eventDate * 1000).toDateString()}`);

  const tx = await pizzaPoap.createEvent(name, description, imageURI, eventDate);
  const receipt = await tx.wait();

  console.log(`\nevent created! tx: ${receipt!.hash}`);

  const totalEvents = await pizzaPoap.totalEvents();
  const eventId = Number(totalEvents) - 1;
  console.log(`event id: ${eventId}`);
  console.log(`\nset DISPENSE_EVENT_ID=${eventId} in your .env to mint for this event`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

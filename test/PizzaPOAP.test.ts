import { expect } from "chai";
import { ethers } from "hardhat";
import { PizzaPOAP } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PizzaPOAP", function () {
  let pizzaPoap: PizzaPOAP;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let stranger: SignerWithAddress;

  beforeEach(async function () {
    [owner, alice, bob, charlie, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PizzaPOAP");
    pizzaPoap = await factory.deploy();
  });

  // ---------------------------------------------------------
  // event creation
  // ---------------------------------------------------------

  describe("createEvent", function () {
    it("should create an event and emit EventCreated", async function () {
      const tx = await pizzaPoap.createEvent(
        "Pizza DAO Call #1",
        "First community call",
        "ipfs://Qm.../image.png",
        1700000000
      );

      await expect(tx)
        .to.emit(pizzaPoap, "EventCreated")
        .withArgs(0, "Pizza DAO Call #1", 1700000000);

      const evt = await pizzaPoap.events(0);
      expect(evt.name).to.equal("Pizza DAO Call #1");
      expect(evt.description).to.equal("First community call");
      expect(evt.imageURI).to.equal("ipfs://Qm.../image.png");
      expect(evt.eventDate).to.equal(1700000000);
      expect(evt.mintCount).to.equal(0);
      expect(evt.active).to.equal(true);
    });

    it("should increment event ids", async function () {
      await pizzaPoap.createEvent("Call #1", "", "", 100);
      await pizzaPoap.createEvent("Call #2", "", "", 200);

      expect(await pizzaPoap.totalEvents()).to.equal(2);

      const evt0 = await pizzaPoap.events(0);
      const evt1 = await pizzaPoap.events(1);
      expect(evt0.name).to.equal("Call #1");
      expect(evt1.name).to.equal("Call #2");
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        pizzaPoap.connect(stranger).createEvent("Nope", "", "", 100)
      ).to.be.revertedWithCustomError(pizzaPoap, "OwnableUnauthorizedAccount");
    });
  });

  // ---------------------------------------------------------
  // batch minting
  // ---------------------------------------------------------

  describe("batchMint", function () {
    beforeEach(async function () {
      await pizzaPoap.createEvent(
        "Pizza DAO Call #1",
        "Weekly call",
        "ipfs://img",
        1700000000
      );
    });

    it("should mint tokens to all attendees", async function () {
      const tx = await pizzaPoap.batchMint(0, [alice.address, bob.address]);

      // check tokens exist and are owned by correct wallets
      expect(await pizzaPoap.ownerOf(0)).to.equal(alice.address);
      expect(await pizzaPoap.ownerOf(1)).to.equal(bob.address);

      // check events emitted
      await expect(tx)
        .to.emit(pizzaPoap, "AttendanceMinted")
        .withArgs(0, alice.address, 0);
      await expect(tx)
        .to.emit(pizzaPoap, "AttendanceMinted")
        .withArgs(0, bob.address, 1);

      // check event mint count
      const evt = await pizzaPoap.events(0);
      expect(evt.mintCount).to.equal(2);
    });

    it("should skip duplicate attendees without reverting", async function () {
      await pizzaPoap.batchMint(0, [alice.address]);

      // try minting alice again alongside bob
      await pizzaPoap.batchMint(0, [alice.address, bob.address]);

      // alice should still only have 1 token, bob should have 1
      expect(await pizzaPoap.balanceOf(alice.address)).to.equal(1);
      expect(await pizzaPoap.balanceOf(bob.address)).to.equal(1);

      // total supply should be 2, not 3
      expect(await pizzaPoap.totalSupply()).to.equal(2);
    });

    it("should skip zero addresses without reverting", async function () {
      await pizzaPoap.batchMint(0, [ethers.ZeroAddress, alice.address]);

      expect(await pizzaPoap.totalSupply()).to.equal(1);
      expect(await pizzaPoap.ownerOf(0)).to.equal(alice.address);
    });

    it("should revert for non-existent event", async function () {
      await expect(
        pizzaPoap.batchMint(99, [alice.address])
      ).to.be.revertedWith("event does not exist");
    });

    it("should revert for inactive event", async function () {
      await pizzaPoap.setEventActive(0, false);

      await expect(
        pizzaPoap.batchMint(0, [alice.address])
      ).to.be.revertedWith("event is not active");
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        pizzaPoap.connect(stranger).batchMint(0, [alice.address])
      ).to.be.revertedWithCustomError(pizzaPoap, "OwnableUnauthorizedAccount");
    });
  });

  // ---------------------------------------------------------
  // soulbound (non-transferable)
  // ---------------------------------------------------------

  describe("soulbound", function () {
    beforeEach(async function () {
      await pizzaPoap.createEvent("Call #1", "", "ipfs://img", 100);
      await pizzaPoap.batchMint(0, [alice.address]);
    });

    it("should block transferFrom", async function () {
      await expect(
        pizzaPoap.connect(alice).transferFrom(alice.address, bob.address, 0)
      ).to.be.revertedWith("PizzaPOAP: soulbound, transfers disabled");
    });

    it("should block safeTransferFrom", async function () {
      await expect(
        pizzaPoap
          .connect(alice)
          ["safeTransferFrom(address,address,uint256)"](
            alice.address,
            bob.address,
            0
          )
      ).to.be.revertedWith("PizzaPOAP: soulbound, transfers disabled");
    });
  });

  // ---------------------------------------------------------
  // metadata
  // ---------------------------------------------------------

  describe("tokenURI", function () {
    beforeEach(async function () {
      await pizzaPoap.createEvent(
        "Pizza DAO Call #1",
        "Weekly call",
        "ipfs://img",
        1700000000
      );
      await pizzaPoap.batchMint(0, [alice.address]);
    });

    it("should return a base64-encoded json data uri", async function () {
      const uri = await pizzaPoap.tokenURI(0);

      // should start with data uri prefix
      expect(uri).to.match(/^data:application\/json;base64,/);

      // decode and parse
      const base64 = uri.replace("data:application/json;base64,", "");
      const json = JSON.parse(Buffer.from(base64, "base64").toString());

      expect(json.name).to.equal("Pizza DAO Call #1 #0");
      expect(json.description).to.equal("Weekly call");
      expect(json.image).to.equal("ipfs://img");
      expect(json.attributes).to.have.length(4);
    });

    it("should revert for non-existent token", async function () {
      await expect(pizzaPoap.tokenURI(999)).to.be.reverted;
    });
  });

  // ---------------------------------------------------------
  // view helpers
  // ---------------------------------------------------------

  describe("view helpers", function () {
    it("totalSupply and totalEvents should start at 0", async function () {
      expect(await pizzaPoap.totalSupply()).to.equal(0);
      expect(await pizzaPoap.totalEvents()).to.equal(0);
    });
  });
});

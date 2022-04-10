import type { ContractReceipt } from "ethers";
import { ethers, network } from "hardhat";

async function main() {
  console.log("deploying to network:", network.name);

  const Factory = await ethers.getContractFactory("Factory");
  const Token = await ethers.getContractFactory("Token");

  const factory = await Factory.deploy();
  await factory.deployed();

  console.log(`Factory address: ${factory.address}`);

  const token = await Token.deploy("Tether", "USDT", (10 ** 18).toString());
  await token.deployed();

  console.log(`Tether Token address: ${token.address}`);

  const tx = await factory.createExchange(token.address);
  const receipt = await tx.wait();
  const exchangeAddress = getExchangeAddressFromReceipt(receipt);

  console.log(`Exchange address for ETH/USDT: ${exchangeAddress}`);
}

function getExchangeAddressFromReceipt(receipt: ContractReceipt): string {
  if (!receipt.events) {
    throw new Error("no events found on contract receipt");
  }
  const event = receipt.events.find((e) => e.event === "DeployedExchange");
  if (!event) {
    throw new Error("DeployedExchange event not found on contract receipt");
  }
  if (!event?.args?.length) {
    throw new Error("no args found on DeployedExchange event");
  }
  if (event.args.length !== 2) {
    throw new Error("invalid DeployedExchange event arguments");
  }
  return event.args[1];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import type { ContractReceipt } from "ethers";
import { ethers, network } from "hardhat";
import { toWei } from "../lib/ethersutil";

/**
 * Script configurantion parameters.
 */
const TETHER_TOKEN_SUPPLY = toWei(10 ** 18);
const POOL_ETH = toWei(10000);
const POOL_USDT = toWei(3000 * 10000);

async function main() {
  console.log("deploying to network:", network.name);

  // Deploy factory contract.
  const Factory = await ethers.getContractFactory("Factory");
  const factory = await Factory.deploy();
  await factory.deployed();

  console.log(`Factory address: ${factory.address}`);

  // Deploy tether token contract.
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy(
    "Tether",
    "USDT",
    TETHER_TOKEN_SUPPLY.toString()
  );
  await token.deployed();

  console.log(`Tether Token address: ${token.address}`);

  // Create exchange through factory.
  let tx = await factory.createExchange(token.address);
  const receipt = await tx.wait();
  const exchangeAddress = getExchangeAddressFromReceipt(receipt);
  const exchange = await ethers.getContractAt("Exchange", exchangeAddress);

  console.log(`Exchange address for ETH/USDT: ${exchangeAddress}`);

  // Appove exchange to transfer tokens on behalf of owner.
  console.log("approving exchange to transfer tokens...");

  tx = await token.approve(exchange.address, POOL_USDT);
  await tx.wait();

  // Add liquidity to the exchange.
  console.log("adding liquidity to exchange...");
  tx = await exchange.addLiquidity(POOL_USDT, { value: POOL_ETH });
  await tx.wait();
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

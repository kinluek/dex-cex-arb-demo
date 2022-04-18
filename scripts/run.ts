import { ContractReceipt } from "ethers";
import { ethers, network } from "hardhat";
import { Arbitrage } from "../lib/arb/Arbitrage";
import { BinanceMarketDepthStream } from "../lib/cex";
import { EthUsdtPriceStream } from "../lib/dex";
const { utils } = ethers;

/**
 * Program configurantion parameters.
 */
const TETHER_TOKEN_SUPPLY = utils.parseUnits((10 ** 18).toString(), 6); // Tether's smallest division is to 6 decimal places.
const INITIAL_ETH_PRICE_IN_MICRO_USDT = utils.parseUnits("3018.42", 6); // change this based on whatever the current price of ETH is.
const INITIAL_POOL_ETH = 10000;
const INITIAL_POOL_ETH_IN_WEI = utils.parseEther(INITIAL_POOL_ETH.toString());
const INITIAL_POOL_USDT_IN_MICRO = INITIAL_ETH_PRICE_IN_MICRO_USDT.mul(INITIAL_POOL_ETH);
const INITIAL_USDT_PRICE_IN_WEI = INITIAL_POOL_ETH_IN_WEI.mul(10 ** 6).div(INITIAL_POOL_USDT_IN_MICRO);
const ARB_PERCENTAGE_DIFF_TARGET = 5; // Arbitrage bot will look for price differences between exchanges that exceed this percentage.

console.log("ETH PRICE IN MIRCO USDT: ", INITIAL_ETH_PRICE_IN_MICRO_USDT.toString());
console.log("USDT PRICE IN WEI: ", INITIAL_USDT_PRICE_IN_WEI.toString());

async function main() {
  console.log("deploying to network:", network.name);

  // Deploy factory contract.
  const Factory = await ethers.getContractFactory("Factory");
  const factory = await Factory.deploy();
  await factory.deployed();

  console.log(`Factory address: ${factory.address}`);

  // Deploy tether token contract.
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy("Tether", "USDT", TETHER_TOKEN_SUPPLY.toString());
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
  tx = await token.approve(exchange.address, INITIAL_POOL_USDT_IN_MICRO);
  await tx.wait(1);

  // Add liquidity to the exchange.
  console.log("adding liquidity to exchange...");
  tx = await exchange.addLiquidity(INITIAL_POOL_USDT_IN_MICRO, { value: INITIAL_POOL_ETH_IN_WEI });
  await tx.wait(1);

  // Run arbitrage bot
  const cexStream = new BinanceMarketDepthStream("ethusdt", 3000);
  const dexStream = new EthUsdtPriceStream(token, exchange, exchangeAddress);
  const arbitrage = new Arbitrage(cexStream, dexStream, ARB_PERCENTAGE_DIFF_TARGET);
  await arbitrage.run();

  process.on("SIGINT", () => {
    console.log("shutting down program...");
    arbitrage.end();
    process.removeAllListeners();
  });
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

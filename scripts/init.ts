import type { BigNumber } from "ethers";
import { ethers, network } from "hardhat";

const NETWORK_LOCALHOST = "localhost";

const FACTORY_ADDRESS =
  network.name === NETWORK_LOCALHOST
    ? "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    : "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const TETHER_TKN_ADDRESS =
  network.name === NETWORK_LOCALHOST
    ? "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    : "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const EXCHANGE_ADDRESS =
  network.name === NETWORK_LOCALHOST
    ? "0xa16E02E87b7454126E5E10d957A927A7F5B5d2be"
    : "0xa16E02E87b7454126E5E10d957A927A7F5B5d2be";

const CONFIRMATIONS = network.name === NETWORK_LOCALHOST ? 1 : 12;

/**
 * Initialise the pool with liquidity
 */
async function main() {
  console.log("initialising contracts on network:", network.name);

  const token = await ethers.getContractAt("Token", TETHER_TKN_ADDRESS);
  const exchange = await ethers.getContractAt("Exchange", EXCHANGE_ADDRESS);

  const etherAmount = 10000;
  const tetherAmount = 3000 * etherAmount; // we start the price of ether at 3000USDT/ETH

  const etherAmountWei = toWei(etherAmount);
  const tetherAmountWei = toWei(tetherAmount);

  console.log("approving exchange to transfer tokens...");
  let tx = await token.approve(exchange.address, tetherAmountWei);
  await tx.wait(CONFIRMATIONS);

  console.log("adding liquidity to exchange...");
  tx = await exchange.addLiquidity(tetherAmountWei, { value: etherAmountWei });
  await tx.wait(CONFIRMATIONS);

  const usdtInPool = (await exchange.getReserve()).toString();
  const etherInPool = (await getBalance(exchange.address)).toString();

  console.log(`USDT: ${usdtInPool} - ETH: ${etherInPool}`);
}

function toWei(value: number): BigNumber {
  return ethers.utils.parseEther(value.toString());
}

const getBalance = ethers.provider.getBalance;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

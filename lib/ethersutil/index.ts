import type { BigNumber } from "ethers";
import { ethers } from "hardhat";

export function toWei(value: number): BigNumber {
  return ethers.utils.parseEther(value.toString());
}

export const getBalance = ethers.provider.getBalance;

export const formatEther = ethers.utils.formatEther;

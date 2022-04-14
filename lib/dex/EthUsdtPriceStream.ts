import { Token, Exchange } from "../../typechain";
import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";

/**
 * Prices are given in the smallest unit for each asset.
 */
type Prices = {
  ethInMicroUsdt: BigNumber;
  usdtInWei: BigNumber;
};

/**
 * Callback provided to handle price updates from the exchange.
 */
type OnPriceCallback = (msg: Prices) => void;

/**
 * EthUsdtPriceStream subscribes to price changes of ETH and USDT from the exchange.
 */
export class EthUsdtPriceStream {
  constructor(
    private token: Token,
    private exchange: Exchange,
    readonly exchangeAddress: string,
    private onPriceCallback: OnPriceCallback
  ) {
    const filterFromExchange = token.filters.Transfer(exchangeAddress);
    const filterToExchange = token.filters.Transfer(null, exchangeAddress);
    this.token.on(filterFromExchange, () => this.getExchangePrices(this.exchange));
    this.token.on(filterToExchange, () => this.getExchangePrices(this.exchange));
  }

  private getExchangePrices = async (exchange: Exchange): Promise<void> => {
    const tokenAmount = await exchange.getReserve();
    const ethAmount = await ethers.provider.getBalance(exchange.address);
    const ethInMicroUsdt = utils.parseEther(tokenAmount.toString()).div(ethAmount);
    const usdtInWei = ethAmount.mul(10 ** 6).div(tokenAmount);
    this.onPriceCallback({ ethInMicroUsdt, usdtInWei });
  };

  public close = () => {
    this.token.removeAllListeners();
  };
}

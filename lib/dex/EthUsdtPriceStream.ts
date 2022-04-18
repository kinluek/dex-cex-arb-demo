import { Token, Exchange } from "../../typechain";
import { ethers } from "hardhat";
import { BigNumber, Event, utils } from "ethers";

/**
 * Prices are given in the smallest unit for each asset.
 */
export type Prices = {
  ethInMicroUsdt: BigNumber;
  usdtInWei: BigNumber;
};

/**
 * Callback provided to handle price updates from the exchange.
 */
export type OnPriceCallback = (msg: Prices) => void;

/**
 * EthUsdtPriceStream subscribes to price changes of ETH and USDT from the exchange.
 */
export class EthUsdtPriceStream {
  private latestBlockNumber = 0;
  private token: Token;
  private exchange: Exchange;
  readonly exchangeAddress: string;

  constructor(token: Token, exchange: Exchange, exchangeAddress: string) {
    this.token = token;
    this.exchange = exchange;
    this.exchangeAddress = exchangeAddress;
  }

  /**
   * Listen to exchange price changes in realtime.
   */
  public listen(onPriceCallback: OnPriceCallback) {
    const filterFromExchange = this.token.filters.Transfer(this.exchangeAddress);
    const filterToExchange = this.token.filters.Transfer(null, this.exchangeAddress);
    // any transfer to or from the exchange will cause a price change.
    // for every event, we calcuate the current prices based on the liquidity ratios.
    this.token.on(filterFromExchange, (...args) => this.handleOnPriceCallback(args[3], onPriceCallback));
    this.token.on(filterToExchange, (...args) => this.handleOnPriceCallback(args[3], onPriceCallback));
  }

  /**
   * Get the current exchange price.
   */
  public async getExchangePrices(): Promise<Prices> {
    const tokenAmount = await this.exchange.getReserve();
    const ethAmount = await ethers.provider.getBalance(this.exchange.address);
    const ethInMicroUsdt = utils.parseEther(tokenAmount.toString()).div(ethAmount);
    const usdtInWei = ethAmount.mul(10 ** 6).div(tokenAmount);
    return { ethInMicroUsdt, usdtInWei };
  }

  private handleOnPriceCallback = async (event: Event, cb: OnPriceCallback): Promise<void> => {
    // pools can only be updated once per block.
    // this makes sure we are not polling the exchange more than we need to and removes
    // out of order events.
    if (event.blockNumber <= this.latestBlockNumber) {
      return;
    }
    this.latestBlockNumber = event.blockNumber;
    const prices = await this.getExchangePrices();
    cb(prices);
  };

  public close = () => {
    this.token.removeAllListeners();
  };
}

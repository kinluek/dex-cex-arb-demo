import { BigNumber, utils } from "ethers";
import { BinanceMarketDepthStream, MarketDepthStreamEvent } from "../cex";
import { EthUsdtPriceStream, Prices } from "../dex";
import { GasStation } from "../gas/GasStation";

// Abritrage program which watches for opportunies between the exchanges and
// executes trades.
export class Arbitrage {
  private cexStream;
  private dexStream;

  private gasStation;

  /**
   * only looks for abritrage opportunies with a percentage difference
   * between the exchange greater than the one set here.
   */
  private percentageDiffTarget: BigNumber;

  private dexPriceOfEthInMicroUsdt = BigNumber.from(0);
  private dexPriceOfUsdtInWei = BigNumber.from(0);

  private cexHighestBidInMicroUsdt = BigNumber.from(0);
  private cexLowestAskInMicroUsdt = BigNumber.from(0);

  /**
   * percentage provided must be greater than zero
   */
  constructor(
    cexStream: BinanceMarketDepthStream,
    dexStream: EthUsdtPriceStream,
    gasStation: GasStation,
    percentageDiffTarget: number
  ) {
    if (percentageDiffTarget <= 0) throw Error("must provide percentageDiffTarget value greater than 0");
    this.cexStream = cexStream;
    this.dexStream = dexStream;
    this.gasStation = gasStation;

    // get the percentage in the same units as microUSDT ie 100,500,000 == 100.500000% 10,000,000 == 10.000000%
    this.percentageDiffTarget = utils.parseUnits(percentageDiffTarget.toString(), 6);
  }

  public async run(): Promise<void> {
    const { ethInMicroUsdt, usdtInWei } = await this.dexStream.getExchangePrices();
    const { bids, asks } = await this.cexStream.getOrderBook();

    this.dexPriceOfEthInMicroUsdt = ethInMicroUsdt;
    this.dexPriceOfUsdtInWei = usdtInWei;
    console.log(`DEX: ETH PRICE: ${ethInMicroUsdt} microUSDT`);
    console.log(`DEX: USDT PRICE: ${usdtInWei} WEI`);

    this.cexHighestBidInMicroUsdt = utils.parseUnits(bids[0][0], 6);
    this.cexLowestAskInMicroUsdt = utils.parseUnits(asks[0][0], 6);
    console.log(`CEX: HIGHEST BID: ${this.cexHighestBidInMicroUsdt} microUSDT`);
    console.log(`CEX: LOWEST ASK: ${this.cexLowestAskInMicroUsdt} microUSDT`);

    this.cexStream.listen(this.onCexDepth);
    this.dexStream.listen(this.onDexPrice);
  }

  private onCexDepth = async ({ b, a }: MarketDepthStreamEvent) => {
    if (b.length > 0) {
      const highestBid = b[0][0];
      const newBigInMicroUsdt = utils.parseUnits(highestBid, 6);
      if (!newBigInMicroUsdt.eq(this.cexHighestBidInMicroUsdt)) {
        console.log(`CEX: NEW HIGHEST BID: ${newBigInMicroUsdt} microUSDT`);
        this.cexHighestBidInMicroUsdt = newBigInMicroUsdt;
        await this.executeArbIfFeasible();
      }
    }
    if (a.length > 0) {
      const lowestAsk = a[0][0];
      const newLowestAsk = utils.parseUnits(lowestAsk, 6);
      if (!newLowestAsk.eq(this.cexLowestAskInMicroUsdt)) {
        console.log(`CEX: NEW LOWEST ASK: ${newLowestAsk} microUSDT`);
        this.cexLowestAskInMicroUsdt = newLowestAsk;
        await this.executeArbIfFeasible();
      }
    }
  };

  private onDexPrice = async ({ ethInMicroUsdt, usdtInWei }: Prices) => {
    console.log(`DEX: ETH PRICE: ${ethInMicroUsdt} microUSDT`);
    console.log(`DEX: USDT PRICE: ${usdtInWei} WEI`);
    this.dexPriceOfEthInMicroUsdt = ethInMicroUsdt;
    this.dexPriceOfUsdtInWei = usdtInWei;
    await this.executeArbIfFeasible();
  };

  /**
   * Checks whether there is an opportunity to perform arbitrage and then executes it if possible.
   *
   * This function will calculate the potential profit by taking into account, gas fees, depth of market and slippage.
   * We will use https://ethgasstation.info/api/ethgasAPI.json? to find the fastest gas price to make sure
   * transactions are prioritised.
   */
  private async executeArbIfFeasible() {
    const askDiff = this.getPercentageDifference(this.cexLowestAskInMicroUsdt);
    const bidDiff = this.getPercentageDifference(this.cexHighestBidInMicroUsdt);

    // If people are selling ETH on CEX at a lower price than on DEX
    if (askDiff.lte(this.percentageDiffTarget.mul(-1))) {
      // buy ETH on Cex and sell ETH on Dex
      console.log("ARB OPPORTUNITY SPOTTED: buy ETH on Cex and sell ETH on Dex");
      const gasPrice = await this.gasStation.getFastestPriceInWei();
      console.log(`FASTEST GAS PRICE: ${gasPrice.toString()}`);
    }

    // If people are buying ETH on CEX at a higher price than on DEX
    if (bidDiff.gte(this.percentageDiffTarget)) {
      // buy ETH on Dex and sell ETH on Cex
      console.log("ARB OPPORTUNITY SPOTTED: buy ETH on Dex and sell ETH on Cex");
      const gasPrice = await this.gasStation.getFastestPriceInWei();
      console.log(`FASTEST GAS PRICE: ${gasPrice.toString()}`);
    }
  }

  private getPercentageDifference(cexPrice: BigNumber): BigNumber {
    const percentDiff = cexPrice
      .sub(this.dexPriceOfEthInMicroUsdt)
      .mul(10 ** 8)
      .div(this.dexPriceOfEthInMicroUsdt);
    return percentDiff;
  }

  public end() {
    this.cexStream.close();
    this.dexStream.close();
    this.gasStation.close();
  }
}

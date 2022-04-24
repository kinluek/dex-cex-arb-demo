import axios from "axios";
import { BigNumber, utils } from "ethers";
import { closeSync } from "fs";

const GAS_STATION_API_URL = "https://ethgasstation.info/api/ethgasAPI.json";

type GasInfo = {
  fast: number;
  fastest: number;
  safeLow: number;
  average: number;
  block_time: number;
  blockNum: number;
  speed: number;
  safeLowWait: number;
  avgWait: number;
  fastWait: number;
  fastestWait: number;
};

// GasStation gets gas price information. Price info is cached for the given ttl.
export class GasStation {
  readonly apiUrl = GAS_STATION_API_URL;

  private latestGasInfo: GasInfo | null = null;
  private intervalCloser;

  constructor(ttlMilli: number) {
    this.intervalCloser = setInterval(async () => {
      const { data } = await axios.get<GasInfo>(this.apiUrl);
      this.latestGasInfo = data;
    }, ttlMilli);
  }

  public async getFastestPriceInWei(): Promise<BigNumber> {
    const { fastest } = await this.getGasInfo();
    return utils.parseUnits(fastest.toString(), 9);
  }

  // gas prices are returned in Gwei
  public async getGasInfo(): Promise<GasInfo> {
    if (this.latestGasInfo) return this.latestGasInfo;
    const { data } = await axios.get<GasInfo>(this.apiUrl);
    this.latestGasInfo = data;
    return data;
  }

  public close() {
    clearInterval(this.intervalCloser);
  }
}

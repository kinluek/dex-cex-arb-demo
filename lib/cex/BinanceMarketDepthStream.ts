import WebSocket from "ws";
import axios from "axios";

export type OrderBook = {
  lastUpdateId: number;
  bids: Array<string[2]>; // bids
  asks: Array<string[2]>; // asks
};

/**
 * Market depth message received on the binance depth websocket stream.
 */
export type MarketDepthStreamEvent = {
  e: string;
  E: number; // unix event time.
  s: string;
  U: number;
  u: number;
  b: Array<string[2]>; // bids
  a: Array<string[2]>; // asks
};

/**
 * Callback provided to the BinanceMarketDepthStream instance to handle depth messages.
 */
export type OnDepthCallback = (msg: MarketDepthStreamEvent) => void;

/**
 * BinanceMarketDepthStream subscribes to a binance depth screen and has functionality
 * to reconnect when messages stop sending (which seems to happen randomly).
 * The connection will also reconnect on any closes that were not initiated by
 * the close() method on the BinanceMarketDepthStream instance.
 */
export class BinanceMarketDepthStream {
  private ws: WebSocket;
  private streamUrl: string;
  private orderBookUrl: string;
  private lastReceiveTime;
  private lastEventTime = 0;
  private CLOSE_CODE_END = 3000;
  private CLOSE_CODE_RECONN = 3001;
  readonly marketId;
  readonly timeoutMs;

  constructor(marketId: string, timeoutMs: number) {
    this.marketId = marketId;
    this.timeoutMs = timeoutMs;
    this.lastReceiveTime = new Date().getTime();
    this.streamUrl = `wss://stream.binance.com:9443/ws/${marketId.toLowerCase()}@depth@100ms`;
    this.orderBookUrl = `https://api.binance.com/api/v3/depth?symbol=${marketId.toUpperCase()}`;
    this.ws = new WebSocket(this.streamUrl);
  }

  /**
   * Listen to market depth updates on the exchange.
   */
  public listen(onMessage: OnDepthCallback) {
    this.attachListeners(this.ws, onMessage);
  }

  /**
   * Get the current order book.
   */
  public async getOrderBook(): Promise<OrderBook> {
    const resp = await axios.get<OrderBook>(this.orderBookUrl);
    return resp.data;
  }

  private attachListeners = (ws: WebSocket, onMessage: OnDepthCallback) => {
    ws.on("open", this.onOpen);
    ws.on("message", this.onMessageWrapper(onMessage));
    ws.on("error", this.onError);
    ws.on("close", this.onCloseWrapper(onMessage));
  };

  /**
   * Wraps the user provided onMessage callback function to keep track of the last message
   * receive time which is used to determine whether the connection should reconnect.
   * Out of date events are ignored.
   */
  private onMessageWrapper = (onMessage: OnDepthCallback): ((msg: Buffer) => void) => {
    return (msg: Buffer) => {
      this.lastReceiveTime = new Date().getTime();
      const event: MarketDepthStreamEvent = JSON.parse(msg.toString());
      if (event.E <= this.lastEventTime) {
        return;
      }
      onMessage(JSON.parse(msg.toString()));
    };
  };

  private onOpen = () => {
    console.log("websocket connection established");
    const interval = setInterval(() => {
      const now = new Date().getTime();
      if (now - this.lastReceiveTime > this.timeoutMs) {
        console.log("timed out waiting for new message");
        clearInterval(interval);
        this.ws.close(this.CLOSE_CODE_RECONN);
      }
    }, 500);
  };

  private onError = (err: Error) => {
    console.log(`error received on websocket: ${err}`);
  };

  /**
   * Makes sure websocket is reopened and configured in case of unexpected closure.
   */
  private onCloseWrapper = (onMessage: OnDepthCallback): ((code: number, reason: Buffer) => void) => {
    return (code: number, reason: Buffer) => {
      if (code !== this.CLOSE_CODE_END) {
        console.log("connection was closed unexpectedly");
        console.log(`code: ${code} - reason: ${reason.toString()}`);
        console.log("reconnecting...");
        this.ws = new WebSocket(this.streamUrl);
        this.attachListeners(this.ws, onMessage);
      }
      console.log("connection was closed");
    };
  };

  public close() {
    this.ws.close(this.CLOSE_CODE_END);
    this.ws.removeAllListeners();
  }
}

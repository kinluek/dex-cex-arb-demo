import WebSocket from "ws";

/**
 * Market depth message received on the binance depth websocket stream.
 */
type MarketDepth = {
  e: string;
  E: number;
  s: string;
  U: number;
  u: number;
  b: Array<string[]>; // bids
  a: Array<string[]>; // asks
};

/**
 * Callback provided to the BinanceMarketDepthStream instance to handle depth messages.
 */
type OnMessageCallback = (msg: MarketDepth) => void;

/**
 * BinanceMarketDepthStream subscribes to a binance depth screen and has functionality
 * to reconnect when messages stop sending (which seems to happen randomly).
 * The connection will also reconnect on any closes that were not initiated by
 * the close() method on the BinanceMarketDepthStream instance.
 */
export class BinanceMarketDepthStream {
  private ws: WebSocket;
  private streamUrl: string;
  private lastReceiveTime;
  private CLOSE_CODE_END = 3000;
  private CLOSE_CODE_RECONN = 3001;

  constructor(readonly marketId: string, readonly timeoutMs: number, private onMessage: OnMessageCallback) {
    this.lastReceiveTime = new Date().getTime();
    this.streamUrl = `wss://stream.binance.com:9443/ws/${marketId}@depth@1000ms`;
    this.ws = new WebSocket(this.streamUrl);
    this.attachListeners(this.ws);
  }

  private attachListeners = (ws: WebSocket) => {
    ws.on("open", this.onOpen);
    ws.on("message", this.onMessageWrapper());
    ws.on("error", this.onError);
    ws.on("close", this.onClose);
  };

  /**
   * Wraps the user provided onMessage callback function to keep track of the last message
   * receive time which is used to determine whether the connection should reconnect.
   */
  private onMessageWrapper = (): ((msg: Buffer) => void) => {
    return (msg: Buffer) => {
      this.lastReceiveTime = new Date().getTime();
      this.onMessage(JSON.parse(msg.toString()));
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

  private onClose = (code: number, reason: Buffer) => {
    if (code !== this.CLOSE_CODE_END) {
      console.log("connection was closed unexpectedly");
      console.log(`code: ${code} - reason: ${reason.toString()}`);
      console.log("reconnecting...");
      this.ws = new WebSocket(this.streamUrl);
      this.attachListeners(this.ws);
    }
    console.log("connection was closed");
  };

  public close = () => {
    this.ws.close(this.CLOSE_CODE_END);
  };
}

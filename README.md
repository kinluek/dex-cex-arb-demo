# dex-cex-arb-demo

The project serves as a demo on how to perform arbitrage between a centralised order book crypto exchange and a decentralised AMM exchange.

The code is not intended to be run on mainnet as is, as assumptions will be made to simplyify the demo while still demonstrating the main concepts.

## DEX

For the DEX we will be using a solidity clone of the Uniswap V1 contracts (for simplicity) borrowed from https://github.com/Jeiwan/zuniswap with a few minor tweaks.

## CEX

We will use Kraken for the CEX. As we will only be running the bot locally and on test nets, we will only use the CEX API to retrieve data, calls to create orders on the CEX will be mocked.

## Trading Pair

We will use the ETH/USDT pool (DEX) and market (CEX) to perform arbitrage between.

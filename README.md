# dex-cex-arb-demo

The project serves as a demo on how to perform arbitrage between a centralised order book crypto exchange and a decentralised AMM exchange.

The code is not intended to be run on mainnet as is, as assumptions will be made to simplyify the demo while still demonstrating the main concepts.

PS: Learning things as we go along...

## DEX

For the DEX we will be using a solidity clone of the Uniswap V1 contracts (for simplicity) borrowed from https://github.com/Jeiwan/zuniswap with a few minor tweaks.

## CEX

We will use Binance for the CEX. As we will only be running the bot locally and on test nets, we will only use the CEX API to retrieve data, calls to create orders on the CEX will be mocked.

## Trading Pair

We will use the ETH/USDT pool (DEX) and market (CEX) to perform arbitrage between.

## Setup

```bash
# make sure you are LTS version of node for hardhat to work.
$ nvm use --lts

# install dependencies
$ npm install

# start hardhat local node
$ npm run node

# run the program
$ npm start
```

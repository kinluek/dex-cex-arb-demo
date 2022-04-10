//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./Exchange.sol";
import "hardhat/console.sol";

contract Factory {
    mapping(address => address) public tokenToExchange;

    event DeployedExchange(address tokenAddres, address exchangeAddress);

    function createExchange(address _tokenAddress) public returns (address) {
        require(_tokenAddress != address(0), "invalid token address");
        require(
            tokenToExchange[_tokenAddress] == address(0),
            "exchange already exists"
        );

        Exchange exchange = new Exchange(_tokenAddress);
        address exchangeAddr = address(exchange);
        tokenToExchange[_tokenAddress] = exchangeAddr;
        
        console.log("deployed exchange address: %s", exchangeAddr);
        emit DeployedExchange(_tokenAddress, exchangeAddr);

        return exchangeAddr;
    }

    function getExchange(address _tokenAddress) public view returns (address) {
        return tokenToExchange[_tokenAddress];
    }
}

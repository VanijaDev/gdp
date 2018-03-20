pragma solidity ^0.4.19;

import '../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol';

contract WhitelistedCrowdsale is Ownable {
  mapping (address => bool) public whitelist;

/**
  * MODIFIERS
 */
  modifier onlyWhitelisted(address _address) {
    require(whitelist[_address]);
    _;
  }

/**
  * PUBLIC
 */
  function WhitelistedCrowdsale(address[] _allowedAddresses) public {
    uint allowedLength = _allowedAddresses.length;

    //  loop through list
    for (uint i = 0; i < allowedLength; i++) {
      address addr = _allowedAddresses[i];
      whitelist[addr] = true;
    }

    //  add msg.sender
    whitelist[msg.sender] = true;
  }

  function addToWhitelist(address[] _addresses) public onlyOwner {
    uint addressLength = _addresses.length;

    for (uint i = 0; i < addressLength; i++) {
      address addr = _addresses[i];
      whitelist[addr] = true;
    }
  }

  function removeFromWhitelist(address[] _addresses) public onlyOwner {
    uint addressLength = _addresses.length;

    for (uint i = 0; i < addressLength; i++) {
      address addr = _addresses[i];
      whitelist[addr] = false;
    }
  }

  function isWhitelisted(address _address) public view returns (bool) {
    return whitelist[_address];
  }
}

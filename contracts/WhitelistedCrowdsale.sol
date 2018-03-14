pragma solidity ^0.4.18;

import '../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol';

contract WhitelistedCrowdsale is Ownable {
  mapping (address => bool) public allowedAddresses;

/**
  * MODIFIERS
 */
  modifier onlyWhitelisted(address _address) {
    require(allowedAddresses[_address]);
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
      allowedAddresses[addr] = true;
    }

    //  add msg.sender
    allowedAddresses[msg.sender] = true;
  }

  function addToWhitelist(address[] _addresses) public onlyOwner {
    uint addressLength = _addresses.length;

    for (uint i = 0; i < addressLength; i++) {
      address addr = _addresses[i];
      allowedAddresses[addr] = true;
    }
  }

  function removeFromWhitelist(address[] _addresses) public onlyOwner {
    uint addressLength = _addresses.length;

    for (uint i = 0; i < addressLength; i++) {
      address addr = _addresses[i];
      allowedAddresses[addr] = false;
    }
  }

  function isWhitelisted(address _address) public view returns (bool) {
    return allowedAddresses[_address];
  }
}

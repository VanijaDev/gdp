pragma solidity ^0.4.19;

import '../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../node_modules/zeppelin-solidity/contracts/token/ERC20/StandardToken.sol';

contract GDPToken is Ownable, StandardToken {

  string public constant name = "GOODS DIGITAL PASSPORT";
  string public constant symbol = "GDP";
  uint8 public constant decimals = 18;

  function GDPToken() public {
    totalSupply_ = 100000000 * uint(10)**decimals;  //  100 000 000 tokens
    balances[owner] = totalSupply_;
  }

  function burnTokens() public onlyOwner {
    balances[owner] = 0;
  }

  /**
    * OVERRIDEN
   */

  function transferOwnership(address newOwner) public onlyOwner {
    uint256 ownerBalance = balances[owner];
    balances[owner] = 0;

    super.transferOwnership(newOwner);
    
    balances[owner] = ownerBalance;
  }
}

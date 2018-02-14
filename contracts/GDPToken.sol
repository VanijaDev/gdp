pragma solidity ^0.4.18;

import "../node_modules/zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract GDPToken is MintableToken {

  string public constant name = "TODO";
  string public constant symbol = "GDP";
  uint8 public constant decimals = 18;

  uint256 private totalSupplyLimit;

  function GDPToken(uint256 _totalSupplyLimit) public {
    totalSupplyLimit = _totalSupplyLimit;
  }

  /**
    * Overriden
   */

   /**
   * @dev Function to mint tokens
   * @param _to The address that will receive the minted tokens.
   * @param _amount The amount of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {
    require(totalSupply_ + _amount <= totalSupplyLimit);
    
    super.mint(_to, _amount);
  }
}

pragma solidity ^0.4.18;

import './GDPToken.sol';
import './PausableCrowdsale.sol';
import './WhitelistedCrowdsale.sol';
import './RefundableCrowdsale.sol';

contract GDPCrowdsale is PausableCrowdsale, WhitelistedCrowdsale, RefundableCrowdsale {

  using SafeMath for uint256;
  
  // The token being sold
  GDPToken public token;

  /**
   *  EVENTS
   */

  /**
   * event for token purchase logging
   * @param purchaser who paid for the tokens
   * @param beneficiary who got the tokens
   * @param value weis paid for purchase
   * @param amount amount of tokens purchased
   */
   // TODO: uptade to styleguides
  event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

  function GDPCrowdsale(uint256[] _startTimes, uint256[] _endTimes, uint256[] _rates, address[] _whitelist, address _wallet, uint256 _goal) 
    WhitelistedCrowdsale(_whitelist)
    RefundableCrowdsale(_wallet, _goal, _startTimes, _endTimes, _rates) public payable {
      require(msg.value > 0);
  }

  /**
    * PUBLIC
   */
   
  // fallback function can be used to buy tokens
  function() external payable {
    buyTokens(msg.sender);
  }

  // low level token purchase function
  function buyTokens(address beneficiary) isNotPaused onlyWhitelisted(msg.sender) public payable {
    require(beneficiary != address(0));
    require(validPurchase());

    uint256 rate = currentRate();
    require(rate > 0);

    uint256 weiAmount = msg.value;
    uint256 tokens = getTokenAmount(weiAmount, rate);

    token.mint(beneficiary, tokens);
    TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

    forwardFunds();
  }

  //  owner is able to mint tokens manually
  function manualMint(address beneficiary, uint256 _amount) onlyOwner isNotPaused onlyWhitelisted(msg.sender) public {
    require(super.validPurchase());

    token.mint(beneficiary, _amount);
    TokenPurchase(msg.sender, beneficiary, 0, _amount);
  }

  /**
    * PRIVATE
  */

  // creates the token to be sold.
  function createTokenContract() public onlyOwner {
    token = new GDPToken();
  }

  function validPurchase() internal view returns (bool) {
    bool nonZeroPurchase = msg.value > 0;
    bool withinCrowdsalePeriod = super.validPurchase();

    return withinCrowdsalePeriod && nonZeroPurchase;
  }

}
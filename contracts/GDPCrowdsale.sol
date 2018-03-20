pragma solidity ^0.4.19;

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

  function GDPCrowdsale(uint256[] _startTimes, uint256[] _endTimes, uint256 _basicRate, uint256[] _stageBonus, address[] _whitelist, address _wallet, uint256 _goal, address _tokenAddress) 
    WhitelistedCrowdsale(_whitelist)
    RefundableCrowdsale(_wallet, _goal, _startTimes, _endTimes, _basicRate, _stageBonus) public payable {
      require(_tokenAddress != address(0));

      token = GDPToken(_tokenAddress);
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

    uint256 tokens = getTokenAmount(msg.value);

    token.mint(beneficiary, tokens);
    TokenPurchase(msg.sender, beneficiary, msg.value, tokens);

    forwardFunds();
  }

  //  owner is able to mint tokens manually
  function manualMint(address beneficiary, uint256 _amount) onlyOwner isNotPaused onlyWhitelisted(msg.sender) public {
    require(super.validPurchase());

    token.mint(beneficiary, _amount);
    TokenPurchase(msg.sender, beneficiary, 0, _amount);
  }

  function validPurchase() internal view returns (bool) {
    bool nonZeroPurchase = msg.value > 0;
    bool withinCrowdsalePeriod = super.validPurchase();

    return withinCrowdsalePeriod && nonZeroPurchase;
  }


  /**
    * OVERRIDEN
   */

  //  RefundableCrowdsale
   function claimRefund() public {
    super.claimRefund();
    token.finishMinting();
  }

  function forwardFundsToWallet() public onlyOwner {
    super.forwardFundsToWallet();
    token.finishMinting();
  }

}
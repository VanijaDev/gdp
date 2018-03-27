pragma solidity ^0.4.19;

import './GDPToken.sol';
import './PausableCrowdsale.sol';
import './RefundableCrowdsale.sol';

contract GDPCrowdsale is PausableCrowdsale, RefundableCrowdsale {

  using SafeMath for uint256;

  uint8 public constant icoTokensReservedPercent = 65;  //  maximum token amout to be sold during the ICO (in %)
  uint256 public icoTokensReserved; //  maximum token amout to be sold during the ICO
  uint256 public icoTokensSold; //  token amout, sold during the ICO
  uint256 public manualTokensTransferReserved; //  maximum token amout to be manually minted
  uint256 public manualTokensTransferred; //  token amout, manually minted
  
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
  event ManualTransfer(address indexed from, address indexed to, uint256 amount);

  function GDPCrowdsale(uint256[] _startTimes, uint256[] _endTimes, uint256 _basicRate, uint256[] _stageBonus, address _wallet, uint256 _goal, address _tokenAddress)
    RefundableCrowdsale(_wallet, _goal, _startTimes, _endTimes, _basicRate, _stageBonus) public {
      require(_tokenAddress != address(0));

      token = GDPToken(_tokenAddress);

      icoTokensReserved = token.totalSupply().div(100).mul(icoTokensReservedPercent);
      manualTokensTransferReserved = token.totalSupply().sub(icoTokensReserved);
  }

  /**
    * PUBLIC
   */
   
  // fallback function can be used to buy tokens
  function() external payable {
    buyTokens(msg.sender);
  }

  // low level token purchase function
  function buyTokens(address _beneficiary) isNotPaused public payable {
    require(_beneficiary != address(0));
    require(validPurchase());

    uint256 tokens = getTokenAmount(msg.value);
    require(icoTokensSold.add(tokens) <= icoTokensReserved);

    icoTokensSold = icoTokensSold.add(tokens);

    token.transfer(_beneficiary, tokens);
    TokenPurchase(msg.sender, _beneficiary, msg.value, tokens);

    forwardFunds();
  }

  //  owner is able to mint tokens manually
  function manualTransfer(address _beneficiary, uint256 _amount) onlyOwner isNotPaused public {
    require(super.isRunning());
    require(manualTokensTransferred.add(_amount) <= manualTokensTransferReserved);

    manualTokensTransferred = manualTokensTransferred.add(_amount);

    token.transfer(_beneficiary, _amount);
    ManualTransfer(msg.sender, _beneficiary, _amount);
  }

  function validPurchase() private view returns (bool) {
    bool nonZeroPurchase = msg.value > 0;
    bool withinCrowdsalePeriod = super.isRunning();

    return withinCrowdsalePeriod && nonZeroPurchase;
  }


  /**
    * OVERRIDEN
   */

   function claimRefund() public {
    super.claimRefund();
    
    burnTokens();
  }

  function forwardFundsToWallet() public onlyOwner {
    super.forwardFundsToWallet();
    
    burnTokens();
  }

  /**
    * PRIVATE
   */
   function burnTokens() private {
     if(token.balanceOf(address(this)) > 0) {
       token.burnTokens();
     }
   }

}
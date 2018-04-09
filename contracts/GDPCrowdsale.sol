pragma solidity ^0.4.19;

import './GDPToken.sol';
import './PausableCrowdsale.sol';
import './RefundableCrowdsale.sol';

contract GDPCrowdsale is PausableCrowdsale, RefundableCrowdsale {

  using SafeMath for uint256;

  uint8 public constant icoTokensReservedPercent = 85;  //  maximum token amout to be sold during the ICO (in %)
  uint256 public icoTokensReserved; //  maximum token amout to be sold during the ICO
  uint256 public icoTokensSold; //  token amout, sold during the ICO

  address public wallet;  //  wallet for ETH while ico
  
  // The token being sold
  GDPToken public token;

  modifier validTransfer(address _beneficiary, uint256 _amount) {
    require(_beneficiary != address(0));
    require(_amount > 0);
    _;
  }

  /**
   *  EVENTS
   */

  /**
   * @dev event for token purchase logging
   * @param purchaser who paid for the tokens
   * @param beneficiary who got the tokens
   * @param value weis paid for purchase
   * @param amount amount of tokens purchased
   */
  event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);
  event ManualTransfer(address indexed from, address indexed to, uint256 amount);

  function GDPCrowdsale(uint256 _openingTime, uint256 _closingTime, uint256 _basicRate, uint256[] _stageGoals, uint256[] _stageBonuses, address _wallet, uint256 _softCap, uint256 _hardCap, address _tokenAddress)
    RefundableCrowdsale(_softCap, _hardCap, _openingTime, _closingTime, _basicRate, _stageGoals, _stageBonuses) public {
      require(_tokenAddress != address(0));
      require(_wallet != address(0));

      token = GDPToken(_tokenAddress);

      wallet = _wallet;
      icoTokensReserved = token.totalSupply().div(100).mul(icoTokensReservedPercent);
  }

  /**
    * PUBLIC
   */
   
  // fallback function can be used to buy tokens
  function() external payable {
    buyTokens(msg.sender);
  }

  // low level token purchase function
  function buyTokens(address _beneficiary) onlyWhileOpen isNotPaused public payable {
    require(_beneficiary != address(0));
    require(validPurchase());

    uint256 tokens = tokenAmount(msg.value);
    require(icoTokensSold.add(tokens) <= icoTokensReserved);

    icoTokensSold = icoTokensSold.add(tokens);

    token.transfer(_beneficiary, tokens);
    TokenPurchase(msg.sender, _beneficiary, msg.value, tokens);

    forwardFunds();
  }

  //  owner is able to mint tokens manually
  function manualTransfer(address _beneficiary, uint256 _amount) onlyOwner onlyWhileOpen isNotPaused validTransfer(_beneficiary, _amount) public {
    token.transfer(_beneficiary, _amount);
    ManualTransfer(msg.sender, _beneficiary, _amount);
  }

  function forwardFunds() public payable {
    super.forwardFunds();
    wallet.transfer(msg.value);
  }

  function burnTokens() public onlyOwner {
    require(hasEnded());

    token.burnTokens();
  }

  /**
    * PRIVATE
   */

  function validPurchase() private view returns (bool) {
    bool nonZeroPurchase = msg.value > 0;
    bool hardCapIsReached = hardCapReached();

    return nonZeroPurchase && !hardCapIsReached;
  }
}
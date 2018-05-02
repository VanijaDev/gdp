pragma solidity ^0.4.20;

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

    wallet.transfer(msg.value);
    forwardFunds(msg.value);

    TokenPurchase(msg.sender, _beneficiary, msg.value, tokens);
  }

  function manualTransfer(address _beneficiary, uint256 _amount) onlyOwner onlyWhileOpen isNotPaused validTransfer(_beneficiary, _amount) public {
    token.transfer(_beneficiary, _amount);
    ManualTransfer(msg.sender, _beneficiary, _amount);
  }

  /**
   * @dev Owner can add multiple bonus beneficiaries.
   * @param _addresses Beneficiary addresses
   * @param _amounts Beneficiary bonus amounts
   */
  function addBounties(address[] _addresses, uint256[] _amounts) public onlyOwner {
    uint256 addrLength = _addresses.length ;
    require(addrLength == _amounts.length);

    for (uint256 i = 0; i < addrLength; i ++) {
      uint256 singleBounty = _amounts[i];
      require(singleBounty > 0);
      require(icoTokensSold.add(singleBounty) <= icoTokensReserved);
      require(token.increaseApproval(_addresses[i], _amounts[i]) == true);

      icoTokensSold = icoTokensSold.add(singleBounty);
    }
  }

  function isRunning() public view returns (bool) {
    bool timeOpen = now >= openingTime && now <= closingTime;
    return timeOpen && !hardCapReached();
  }

  function burnTokens() public onlyOwner {
    require(timeOver());

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
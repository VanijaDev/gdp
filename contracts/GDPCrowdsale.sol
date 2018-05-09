pragma solidity ^0.4.20;

import './GDPToken.sol';
import './PausableCrowdsale.sol';
import './RefundableCrowdsale.sol';

contract GDPCrowdsale is PausableCrowdsale, RefundableCrowdsale {

  using SafeMath for uint256;

  uint8 public constant icoTokensReservedPercent = 85;  //  maximum token amout to be sold during the ICO (in %)
  uint public minimumInvestment;
  uint256 public icoTokensReserved; //  maximum token amout to be sold during the ICO
  uint256 public icoTokensSold; //  token amout, sold during the ICO

  address public wallet;  //  wallet for ETH while ico
  
  // The token being sold
  GDPToken public token;

  uint256 private manuallySentTokens;
  uint256 private tokenTotalSupply;

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
      minimumInvestment = uint(uint(1).mul(uint(10)**17));
      tokenTotalSupply = token.totalSupply();
      icoTokensReserved = tokenTotalSupply.div(100).mul(icoTokensReservedPercent);
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
    require(icoTokensSold.add(tokens).add(manuallySentTokens) <= tokenTotalSupply);

    icoTokensSold = icoTokensSold.add(tokens);

    token.transfer(_beneficiary, tokens);

    wallet.transfer(msg.value);
    forwardFunds(msg.value);

    TokenPurchase(msg.sender, _beneficiary, msg.value, tokens);
  }

/**
  * @dev Initially tokens will be substracted from reserved tokens == 15% 
 */
  function manualTransfer(address _beneficiary, uint256 _amount) onlyOwner onlyWhileOpen isNotPaused validTransfer(_beneficiary, _amount) public {
    require(manuallySentTokens.add(_amount).add(icoTokensSold) <= tokenTotalSupply);

    manuallySentTokens = manuallySentTokens.add(_amount);
    token.transfer(_beneficiary, _amount);
    ManualTransfer(msg.sender, _beneficiary, _amount);
  }

  /**
   * @dev Owner can add multiple bonus beneficiaries.
   * @param _addresses Beneficiary addresses
   * @param _amounts Beneficiary bonus amounts, icoTokensSold used
   */
  function addBounties(address[] _addresses, uint256[] _amounts) public onlyOwner {
    uint256 addrLength = _addresses.length ;
    require(addrLength == _amounts.length);

    for (uint256 i = 0; i < addrLength; i ++) {
      uint256 singleBounty = _amounts[i];
      require(singleBounty > 0);
      require(icoTokensSold.add(singleBounty) <= icoTokensReserved);
      require(icoTokensSold.add(singleBounty).add(manuallySentTokens) <= tokenTotalSupply);
      token.transfer(_addresses[i], _amounts[i]);

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

  function killContract() public onlyOwner {
    require(!isRunning());
    selfdestruct(owner);
  }

  /**
   * PRIVATE
   */
  function validPurchase() private view returns (bool) {
    bool nonZeroPurchase = msg.value > 0;
    bool meetsMinimumInvestment = msg.value >= minimumInvestment;
    bool hardCapIsReached = hardCapReached();

    return nonZeroPurchase && meetsMinimumInvestment && !hardCapIsReached;
  }
}
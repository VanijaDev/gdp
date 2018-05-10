pragma solidity ^0.4.20;

import './GDPToken.sol';
import './PausableCrowdsale.sol';
import './RefundableCrowdsale.sol';

contract GDPCrowdsale is PausableCrowdsale, RefundableCrowdsale {

  using SafeMath for uint256;

  uint8 public constant icoTokensReservedPercent = 85;  //  maximum token amout to be sold during the ICO (in %)
  uint256 public minimumInvestment;
  uint256 public icoTokensReserved; //  maximum token amout to be sold during the ICO
  uint256 public icoTokensSold; //  token amout, sold during the ICO
  uint256 private privatelyTransferReserved;  //  15%
  uint256 private privatelyTransferred; //  form 15%

  address public wallet;  //  wallet for ETH while ico
  
  // The token being sold
  GDPToken public token;


  // uint256 private manuallyTransferredTokens;
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
  event ManualTransferOfPrivatelyReservedTokens(address indexed from, address indexed to, uint256 amount);
  event ManualTransferOfICOReservedTokens(address indexed from, address indexed to, uint256 amount);

  function GDPCrowdsale(uint256 _openingTime, uint256 _closingTime, uint256 _basicRate, uint256[] _stageGoals, uint256[] _stageBonuses, address _wallet, uint256 _softCap, uint256 _hardCap, address _tokenAddress)
    RefundableCrowdsale(_softCap, _hardCap, _openingTime, _closingTime, _basicRate, _stageGoals, _stageBonuses) public {
      require(_tokenAddress != address(0));
      require(_wallet != address(0));

      token = GDPToken(_tokenAddress);

      wallet = _wallet;
      minimumInvestment = uint(uint(1).mul(uint(10)**17));
      tokenTotalSupply = token.totalSupply();
      icoTokensReserved = tokenTotalSupply.div(100).mul(icoTokensReservedPercent);
      privatelyTransferReserved = tokenTotalSupply.sub(icoTokensReserved);
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
    require(icoTokensSold.add(tokens).add(privatelyTransferred) <= tokenTotalSupply);

    icoTokensSold = icoTokensSold.add(tokens);

    token.transfer(_beneficiary, tokens);

    wallet.transfer(msg.value);
    forwardFunds(msg.value);

    TokenPurchase(msg.sender, _beneficiary, msg.value, tokens);
  }

 /**
  * @dev Token transfer from reserved 15% 
  * @param _beneficiary Beneficiary address
  * @param _amount token amount with decimals (e.g. 238000000000000000000 to transfer 238 tokens)
  */
  function manualTransferPrivateReservedTokens(address _beneficiary, uint256 _amount) onlyOwner onlyWhileOpen isNotPaused validTransfer(_beneficiary, _amount) public {
    require(privatelyTransferred.add(_amount) <= privatelyTransferReserved);

    privatelyTransferred = privatelyTransferred.add(_amount);
    token.transfer(_beneficiary, _amount);
    ManualTransferOfPrivatelyReservedTokens(msg.sender, _beneficiary, _amount);
  }

 /**
  * @dev Token transfer from reserved 85% recerved for ICO 
  * @param _beneficiary Beneficiary address
  * @param _amount token amount with decimals (e.g. 238000000000000000000 to transfer 238 tokens)
  */
  function manualTransferICORecerved(address _beneficiary, uint256 _amount) onlyOwner onlyWhileOpen isNotPaused validTransfer(_beneficiary, _amount) public {
    require(icoTokensSold.add(_amount) <= icoTokensReserved);
    require(icoTokensSold.add(_amount).add(privatelyTransferred) <= tokenTotalSupply);

    icoTokensSold = icoTokensSold.add(_amount);
    token.transfer(_beneficiary, _amount);
    ManualTransferOfICOReservedTokens(msg.sender, _beneficiary, _amount);
  }

  /**
   * @dev Owner can add multiple bonus beneficiaries.
   * @param _addresses Beneficiary addresses
   * @param _amounts Beneficiary bonus amounts; icoTokensSold used; token amount with decimals (e.g. 238000000000000000000 to transfer 238 tokens)
   */
  function addBounties(address[] _addresses, uint256[] _amounts) public onlyOwner {
    uint256 addrLength = _addresses.length ;
    require(addrLength == _amounts.length);

    for (uint256 i = 0; i < addrLength; i ++) {
      uint256 singleBounty = _amounts[i];

      require(singleBounty > 0);
      require(icoTokensSold.add(singleBounty) <= icoTokensReserved);
      require(icoTokensSold.add(singleBounty).add(privatelyTransferred) <= tokenTotalSupply);

      icoTokensSold = icoTokensSold.add(singleBounty);
      token.transfer(_addresses[i], _amounts[i]);
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
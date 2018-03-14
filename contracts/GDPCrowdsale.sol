pragma solidity ^0.4.18;

import './GDPToken.sol';
import './PausableCrowdsale.sol';
import './WhitelistedCrowdsale.sol';
import '../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol';

contract GDPCrowdsale is PausableCrowdsale, WhitelistedCrowdsale {

  using SafeMath for uint256;
  
  // The token being sold
  GDPToken public token;

  // start and end timestamps where investments are allowed (both inclusive)
  uint256[] public startTimes;
  uint256[] public endTimes;

  // address where funds are collected
  address public wallet;

  /** 
    * how many token units a buyer gets per wei
    * @dev includes pre-ICO (0 element) and ICO stages
  */
  uint256[] public rates; // tokens per ether

  // amount of raised money in wei
  uint256 public weiRaised;

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

  function GDPCrowdsale(uint256[] _startTimes, uint256[] _endTimes, uint256[] _rates, address _wallet, address[] _whitelist) 
  WhitelistedCrowdsale(_whitelist) public payable {
    require(msg.value > 0);
    require(_wallet != address(0));
    require(validate_StartTimes_EndTimes_TimeNow_Rates(_startTimes, _endTimes, now, _rates));

    startTimes = _startTimes;
    endTimes = _endTimes;
    wallet = _wallet;
    rates = _rates;
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

    //  update weiRaised 
    weiRaised = weiRaised.add(weiAmount);

    token.mint(beneficiary, tokens);
    TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

    forwardFunds(msg.value);
  }

  //  owner is able to mint tokens manually
  function manualMint(address beneficiary, uint256 _amount) onlyOwner isNotPaused onlyWhitelisted(msg.sender) public {
    token.mint(beneficiary, _amount);
    TokenPurchase(msg.sender, beneficiary, 0, _amount);
  }

  /**
    * stages can be updated all at once
   */
  function updateCrowdsaleStages(uint256[] _startTimes, uint256[] _endTimes) public onlyOwner returns (bool) {
    require(validate_StartTimes_EndTimes(_startTimes, _endTimes));

    startTimes = _startTimes;
    endTimes = _endTimes;

    return true; 
  }

  function updateCrowdsaleFinishTime(uint256 _finishTime) public onlyOwner returns (bool) {
    require(_finishTime > now);
    
    uint lastIdx = stagesCount() - 1;
    require(_finishTime > startTimes[lastIdx]);

    endTimes[lastIdx] = _finishTime;
  }

  // @return true if crowdsale event has ended
  function hasEnded() public view returns (bool) {
    uint lastIdx = stagesCount() - 1;

    return now > endTimes[lastIdx];
  }

  // @return amount of ICO stages (including pre-ICO)
  function stagesCount() public view returns (uint) {
    return rates.length;
  }

  // @return current rate
  function currentRate() public view returns (uint) {
    bool stageFound;
    uint256 stageIdx;
    (stageFound, stageIdx) = currentCrowdsaleStage(now, startTimes, endTimes);
    
    if(!stageFound) {
      return 0;
    }
    return rates[stageIdx];
  }

  /**
    * PRIVATE
  */

  function validate_StartTimes_EndTimes_TimeNow_Rates(uint256[] _startTimes, uint256[] _endTimes, uint _now, uint256[] _rates) private pure returns (bool) {
    //  crowdsale should start in future
    if(_startTimes[0] < _now) {
      return false;
    }
    
    //  rate amount must be equal to stages
    uint ratesLength = _rates.length;
    if(ratesLength != _startTimes.length) {
      return false;
    }

    for (uint i = 0; i < ratesLength; i ++) {
      //  rates must be more 0
      if(_rates[i] <= 0) {
        return false;
      }
    }

    return validate_StartTimes_EndTimes(_startTimes, _endTimes);
  }

  function validate_StartTimes_EndTimes(uint256[] _startTimes, uint256[] _endTimes) private pure returns (bool) {
    uint startTimesLength = _startTimes.length;

    //  length must be qual
    if(_endTimes.length != startTimesLength) {
      return false;
    }

    //  startTime must be less, than endTime in each pair
    for (uint i = 0; i < startTimesLength; i ++) {
      
      if(_startTimes[i] >= _endTimes[i]) {
        return false;
      }

      //  next stage should start on the next second after previous stage finishes. Stage timestamps are inclusive for rate calculations.
      if(i+1 < startTimesLength) {
        uint256 stagesDiff = _startTimes[i+1] - _endTimes[i];  // the difference between stages timestamps
        if(stagesDiff != 1) {
          return false;
        } 
      }
    }

    return true;
  }

  // creates the token to be sold.
  function createTokenContract() public onlyOwner {
    token = new GDPToken();
  }

  function validPurchase() private view returns (bool) {
    bool withinCrowdsalePeriod = now >= startTimes[0] && now <= endTimes[endTimes.length - 1];
    bool nonZeroPurchase = msg.value > 0;

    return withinCrowdsalePeriod && nonZeroPurchase;
  }

  function currentCrowdsaleStage(uint256 _timeNow, uint256[] _startTimes, uint256[] _endTimes) private pure returns (bool found, uint256 idx) {
    uint256 length = _startTimes.length;

    for(uint256 i = 0; i < length; i ++) {
      if(_timeNow >= _startTimes[i] && _timeNow <= _endTimes[i]) {
        found = true;
        idx = i;
      }
    }
  }

  function getTokenAmount(uint256 _weiAmount, uint256 _rate) private pure returns(uint256) {
    return _weiAmount.mul(_rate);
  }

  // send ether to the fund collection wallet
  // override to create custom fund forwarding mechanisms
  function forwardFunds(uint _funds) private {
    wallet.transfer(_funds);
  }

}
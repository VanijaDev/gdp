pragma solidity ^0.4.18;

import '../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol';

contract StagesCrowdsale is Ownable {
  
  using SafeMath for uint256;

  // start and end timestamps where investments are allowed (both inclusive)
  uint256[] public startTimes;
  uint256[] public endTimes;

  /** 
    * how many token units a buyer gets per ETH
    * @dev includes pre-ICO (0 element) and ICO stages
  */
  uint256[] public rates;

  /**
    * PUBLIC
  */
  function StagesCrowdsale(uint256[] _startTimes, uint256[] _endTimes, uint256[] _rates) public {
    require(validate_StartTimes_EndTimes_TimeNow_Rates(_startTimes, _endTimes, now, _rates));

    startTimes = _startTimes;
    endTimes = _endTimes;
    rates = _rates;
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
    * INTERNAL
  */

  function validPurchase() internal view returns (bool) {
    bool withinCrowdsalePeriod = now >= startTimes[0] && now <= endTimes[endTimes.length - 1];
    return withinCrowdsalePeriod;
  }

  function getTokenAmount(uint256 _weiAmount, uint256 _rate) internal pure returns(uint256) {
    return _weiAmount.mul(_rate);
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

  function currentCrowdsaleStage(uint256 _timeNow, uint256[] _startTimes, uint256[] _endTimes) private pure returns (bool found, uint256 idx) {
    uint256 length = _startTimes.length;

    for(uint256 i = 0; i < length; i ++) {
      if(_timeNow >= _startTimes[i] && _timeNow <= _endTimes[i]) {
        found = true;
        idx = i;
      }
    }
  }
}

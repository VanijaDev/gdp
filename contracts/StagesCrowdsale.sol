pragma solidity ^0.4.19;

import '../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol';


contract StagesCrowdsale is Ownable {
  using SafeMath for uint256;

  uint256 public weiRaised;
  uint256 public rate;

  //  maximum wei amount for each stage
  uint256[] public stageGoals;
  uint256[] public stageBonuses;

  function StagesCrowdsale(uint256 _rate, uint256[] _stageGoals, uint256[] _stageBonuses) public {
    require(_rate > 0);
    
    stageGoals = validateAndConvertStagesGoalsToWei(_stageGoals);
    rate = _rate;
    stageBonuses = _stageBonuses;
  }

  /**
   * @dev Returns token count for provided wei amount. Takes in count stage goals.
   */
  function tokenAmount(uint256 _weiAmount) public view returns(uint256) {
    uint256 stageIdxCurrent;
    (, stageIdxCurrent) = currentStageIndex();
    uint256 stageCount = stagesCount();
    
    uint256 basicAmount;
    uint256 bonus;
    uint256 bonusAmount;
    uint256 totalAmount;
    uint256 weiToAdd = _weiAmount;
    
    //  use last bonus if over last limit
    if(stageIdxCurrent == stageCount - 1) {
        basicAmount = weiToAdd.mul(rate);
        bonus = stageBonuses[stageIdxCurrent];
        bonusAmount = basicAmount.div(100).mul(bonus);
        totalAmount = basicAmount + bonusAmount;
        return totalAmount;
    }
    
    uint256 weiRaisedLocal = weiRaised;
    uint256 result;

    for(uint256 i = stageIdxCurrent; i < stageCount; i ++) {
      uint256 stageGoal = stageGoals[i];
      
      uint256 stageWeiToAddLimit = (i == stageIdxCurrent) ? stageGoal - weiRaisedLocal : stageGoals[i];      
      uint256 stageWeiToAdd = (stageWeiToAddLimit < weiToAdd) ? stageWeiToAddLimit : weiToAdd;

      basicAmount = stageWeiToAdd.mul(rate);
      bonus = stageBonuses[i];
      bonusAmount = basicAmount.div(100).mul(bonus);
      totalAmount = basicAmount + bonusAmount;

      result = result.add(totalAmount);
      
      weiRaisedLocal = weiRaisedLocal.add(stageWeiToAdd);
      weiToAdd = weiToAdd.sub(stageWeiToAdd);
      
      if(weiToAdd == 0) {
          return result;
      }
    }
    
    //  if here, wei amount started in stage, but is more that last goal. Calculate tokens as for last stage.
    basicAmount = weiToAdd.mul(rate);
    bonus = stageBonuses[stageCount - 1];
    bonusAmount = basicAmount.div(100).mul(bonus);
    totalAmount = basicAmount + bonusAmount;
    result = result.add(totalAmount);
    
    return result;
  }

  function stagesCount() public view returns (uint) {
    return stageGoals.length;
  }

  function currentStageGoal() public view returns(uint256 goal) {
    uint256 stageIdx;
    (, stageIdx) = currentStageIndex();
    
    return stageGoals[stageIdx];
  }

  function currentStageIndex() public view returns(bool found, uint256 idx) {
    return stageForAmount(weiRaised, stageGoals);
  }

  /**
   * @dev Returns whether current ICO stage was found and its index. Return last index if stage was not found.
   */
  function stageForAmount(uint256 _weiAmount, uint256[] _stageGoals) private pure returns (bool, uint256) {
    uint256 length = _stageGoals.length;
    for(uint256 i = 0; i < length; i ++) {
      if(_weiAmount < _stageGoals[i]) {
        return(true, i);
      }
    }
    
    return(false, length - 1);
  }

  function currentStageBonus() public view returns(uint256) {
    uint256 stageIdx;
    (, stageIdx) = currentStageIndex();

    return stageBonuses[stageIdx];
  }

  function updateStagesBonus(uint256[] _stageBonuses) public onlyOwner {
    stageBonuses = _stageBonuses;
  }

  function updateStageBonus(uint256 _stage, uint256 _stageBonus) public onlyOwner {
    stageGoals[_stage] = _stageBonus;
  }

  function updateStagesGoal(uint256[] _stageGoals) public onlyOwner {
    stageGoals = validateAndConvertStagesGoalsToWei(_stageGoals);
  }

  function updateStageGoal(uint256 _stage, uint256 _stageGoal) public onlyOwner {
    if(_stage > 0) {
      require(stageGoals[_stage-1] < _stageGoal);
    }
    stageGoals[_stage] = _stageGoal;
  }

  /**
   * PRIVATE  
   */

  function validateAndConvertStagesGoalsToWei(uint256[] _stageGoals) private pure returns (uint256[]) {
    uint256 length = _stageGoals.length;
    uint256[] memory result = new uint[](length);
    
    for(uint256 i = 0; i < length; i ++) {
        uint256 goal = _stageGoals[i];
      require(goal > 0);

      if(i > 0) {
        require(goal > _stageGoals[i - 1]);
      }
      
      result[i] = goal.mul(uint(10)**18);
    }
    
    return result;
  }
}
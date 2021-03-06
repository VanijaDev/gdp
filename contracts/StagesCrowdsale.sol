pragma solidity ^0.4.23;

import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';


contract StagesCrowdsale is Ownable {
  using SafeMath for uint256;

  uint256 public softCap;
  uint256 public hardCap;
  uint256 public weiRaised;
  uint256 public rate;

  //  maximum wei amount for each stage
  uint256[] public stageGoals;
  uint256[] public stageBonuses;
  mapping (uint256 => uint256) private raisedInStages;

  constructor(uint256 _rate, uint256 _softCap, uint256 _hardCap, uint256[] _stageGoals, uint256[] _stageBonuses) public {
    require(_rate > 0);
    require(_softCap > 0);
    require(_hardCap > _softCap);

      //  convert to wei
    softCap = _softCap * uint(10)**18;
    hardCap = _hardCap * uint(10)**18;
    
    stageGoals = validateAndConvertStagesGoalsToWei(_stageGoals);
    rate = _rate;
    stageBonuses = _stageBonuses;
  }

  /**
   * @dev Returns amount of basic and bonus token amount.
   */
  function previewTokenAmount(uint256 _weiAmount) public view returns(uint256[2]) {
    //  return basic, bonus
    require(_weiAmount <= hardCap - weiRaised);
    
    bool previewStageFound;
    uint256 previewStageIdxCurrent;
    (previewStageFound, previewStageIdxCurrent) = currentStageIndex();
    uint256 previewStageCount = stagesCount();
    
    uint256 previewBasicAmount;
    uint256 previewBonus;
    uint256 previewBonusAmount;
    uint256 previewWeiToAdd = _weiAmount;
    
    if(!previewStageFound) {
      return [previewWeiToAdd.mul(rate), 0];
    }
    
    for(uint256 i = previewStageIdxCurrent; i < previewStageCount; i ++) {
        uint256 stageWeiToAddMax = stageGoals[i] - raisedInStages[i];
        uint256 stageWeiToAdd = (previewWeiToAdd < stageWeiToAddMax) ? previewWeiToAdd : stageWeiToAddMax;
        
        uint256 currentBasicAmount = stageWeiToAdd.mul(rate);
        previewBasicAmount = previewBasicAmount.add(currentBasicAmount); 
        previewBonus = stageBonuses[i];
        previewBonusAmount = previewBonusAmount.add(currentBasicAmount.div(100).mul(previewBonus));
        
        previewWeiToAdd = previewWeiToAdd.sub(stageWeiToAdd);
        
        if(previewWeiToAdd == 0) {
          return [previewBasicAmount, previewBonusAmount];
        }
    }
    
    //  if here, wei amount started in stage, but is more that last goal. Calculate tokens just for base rate.
    previewBasicAmount = previewBasicAmount.add(previewWeiToAdd.mul(rate));
    
    return [previewBasicAmount, previewBonusAmount];
  }

  /**
   * @dev Returns token count for provided wei amount. Takes in count stage goals.
   */
  function tokenAmount(uint256 _weiAmount) internal returns(uint256) {
    require(_weiAmount <= hardCap - weiRaised);
    
    bool stageFound;
    uint256 stageIdxCurrent;
    (stageFound, stageIdxCurrent) = currentStageIndex();
    uint256 stageCount = stagesCount();
    
    uint256 basicAmount;
    uint256 bonus;
    uint256 bonusAmount;
    uint256 totalAmount;
    uint256 weiToAdd = _weiAmount;
    
    if(!stageFound) {
        return weiToAdd.mul(rate);
    }
    
    uint256 result;
    
    for(uint256 i = stageIdxCurrent; i < stageCount; i ++) {
        uint256 stageWeiToAddMax = stageGoals[i] - raisedInStages[i];
        uint256 stageWeiToAdd = (weiToAdd < stageWeiToAddMax) ? weiToAdd : stageWeiToAddMax;
        
        basicAmount = stageWeiToAdd.mul(rate); 
        bonus = stageBonuses[i];
        bonusAmount = basicAmount.div(100).mul(bonus);
        totalAmount = basicAmount + bonusAmount;
        result = result.add(totalAmount);
        
        weiToAdd = weiToAdd.sub(stageWeiToAdd);
        raisedInStages[i] = raisedInStages[i].add(stageWeiToAdd);
        
        if(weiToAdd == 0) {
          return result;
        }
    }
    
    //  if here, wei amount started in stage, but is more that last goal. Calculate tokens just for base rate.
    basicAmount = weiToAdd.mul(rate);
    result = result.add(basicAmount);
    
    return result;
  }
  
  function weiToReceiveLimit() public view returns (uint256) {
      return hardCap - weiRaised;
  }

  function stagesCount() public view returns (uint) {
    return stageGoals.length;
  }

  function currentStageGoal() public view returns(uint256 goal) {
    uint256 stageIdx;
    (, stageIdx) = currentStageIndex();
    
    return stageGoals[stageIdx];
  }

  function raisedInStage(uint8 _stage) public view returns(uint256) {
    return raisedInStages[_stage];
  }

  /**
   * @dev Returns whether current ICO stage was found and its index. Return last index if stage was not found.
   */
  function currentStageIndex() public view returns(bool found, uint256 idx) {
    uint256 length = stageGoals.length;
    
    for(uint256 i = 0; i < length; i ++) {
      if(raisedInStages[i] < stageGoals[i]) {
          return (true, i);
      }
    }
    
    return(false, length - 1);
  }

  function currentStageBonus() public view returns(uint256) {
    uint256 stageIdx;
    (, stageIdx) = currentStageIndex();

    return stageBonuses[stageIdx];
  }

  function updateStageBonuses(uint256[] _stageBonuses) public onlyOwner {
    stageBonuses = _stageBonuses;
  }

  function updateStageBonus(uint256 _stage, uint256 _stageBonus) public onlyOwner {
    stageBonuses[_stage] = _stageBonus;
  }

  function updateStageGoals(uint256[] _stageGoals) public onlyOwner {
    stageGoals = validateAndConvertStagesGoalsToWei(_stageGoals);
  }

  function updateStageGoal(uint256 _stage, uint256 _stageGoal) public onlyOwner {
    require(_stageGoal.mul(uint(10)**18) >= raisedInStages[_stage]);
    stageGoals[_stage] = _stageGoal.mul(uint(10)**18);
  }

  function softCapReached() public view returns (bool) {
    return weiRaised >= softCap;
  }

  function hardCapReached() public view returns (bool) {
    return weiRaised >= hardCap;
  }

  /**
   * PRIVATE  
   */
  
  function validateAndConvertStagesGoalsToWei(uint256[] _stageGoals) private view returns (uint256[]) {
    uint256 length = _stageGoals.length;
    uint256[] memory result = new uint[](length);
    
    for(uint256 i = 0; i < length; i ++) {
      uint256 goal = _stageGoals[i].mul(uint(10)**18);
      require(goal > 0);
      require(goal >= raisedInStages[i]);

      result[i] = goal;
    }
    
    return result;
  }
}
pragma solidity ^0.4.19;

import '../utils/RefundVault.sol';
import './StagesCrowdsale.sol';
import './TimedCrowdsale.sol';

/**
 * @title RefundableCrowdsale
 * @dev Extension of Crowdsale contract that adds a funding goal, and
 * the possibility of users getting a refund if goal is not met.
 * Uses a RefundVault as the crowdsale's vault.
 */
contract RefundableCrowdsale is TimedCrowdsale, StagesCrowdsale {
  using SafeMath for uint256;

  // refund vault used to hold funds while crowdsale is running
  RefundVault public vault;

  /**
   * @dev Constructor, creates RefundVault.
   */
  function RefundableCrowdsale(uint256 _softCap, uint256 _hardCap, uint256 _openingTime, uint256 _closingTime, uint256 _basicRate, uint256[] _stageGoals, uint256[] _stageBonuses)
    TimedCrowdsale(_openingTime, _closingTime)
    StagesCrowdsale(_basicRate, _stageGoals, _stageBonuses) public {
      require(_softCap > 0);
      require(_hardCap > _softCap);

      //  convert to wei
      softCap = _softCap * uint(10)**18;
      hardCap = _hardCap * uint(10)**18;

      vault = new RefundVault();
  }

  function forwardFunds() public payable {
    weiRaised = weiRaised.add(msg.value);    
    vault.deposit(msg.sender, msg.value);
  }

  /**
   * @dev Investors can claim refunds here if crowdsale is unsuccessful
   */
  function claimRefund() public {
    require(refundEnabled());

    vault.refund(msg.sender);
  }

  function softCapReached() public view returns (bool) {
    return weiRaised >= softCap;
  }

  function hardCapReached() public view returns (bool) {
    return weiRaised >= hardCap;
  }

  /**
   * @dev Check if refund can be claimed
   */  
   function refundEnabled() public view returns(bool) {
     bool icoGoalReached = softCapReached();
     bool icoTimeOver = hasEnded();
     bool vaultHasBalance = address(vault).balance > 0;

     return !icoGoalReached && icoTimeOver && vaultHasBalance;
   }
}
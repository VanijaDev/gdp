pragma solidity ^0.4.23;

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
  constructor(uint256 _softCap, uint256 _hardCap, uint256 _openingTime, uint256 _closingTime, uint256 _basicRate, uint256[] _stageGoals, uint256[] _stageBonuses)
    TimedCrowdsale(_openingTime, _closingTime)
    StagesCrowdsale(_basicRate, _softCap, _hardCap, _stageGoals, _stageBonuses) public {
      vault = new RefundVault();
  }

  function forwardFunds(uint256 _wei) internal {
    weiRaised = weiRaised.add(_wei);    
    vault.deposit(msg.sender, _wei);
  }

  /**
   * @dev Investors can claim refunds here if crowdsale is unsuccessful
   */
  function claimRefund() public {
    require(refundEnabled());

    vault.refund(msg.sender);
  }

  /**
   * @dev Check if refund can be claimed
   */  
   function refundEnabled() public view returns(bool) {
     bool icoSoftGoalReached = softCapReached();
     bool icoTimeOver = timeOver();
     bool vaultHasBalance = address(vault).balance > 0;

     return !icoSoftGoalReached && icoTimeOver && vaultHasBalance;
   }
}
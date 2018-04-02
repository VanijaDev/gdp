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

  // minimum amount of funds to be raised in weis
  uint256 public goal;

  // refund vault used to hold funds while crowdsale is running
  RefundVault public vault;

  /**
   * @dev Constructor, creates RefundVault. 
   * @param _goal Funding goal
   */
  function RefundableCrowdsale(address _wallet, uint256 _goal, uint256 _openingTime, uint256 _closingTime, uint256 _basicRate, uint256[] _stageGoals, uint256[] _stageBonuses)
    TimedCrowdsale(_openingTime, _closingTime)
    StagesCrowdsale(_basicRate, _stageGoals, _stageBonuses) public {
      require(_goal > 0);

      goal = _goal * uint(10)**18;  //  convert to wei

      vault = new RefundVault(_wallet);
  }

  /**
   * @dev Investors can claim refunds here if crowdsale is unsuccessful
   */
  function claimRefund() public {
    require(hasEnded());
    require(!goalReached());

    vault.refund(msg.sender);
  }

  /**
   * @dev Transfer funds to wallet is ICO was successfull
  */
  function forwardFundsToWallet() public onlyOwner {
    require(hasEnded());
    require(goalReached());

    vault.moveFundsToWallet();
  }

  /**
   * @dev Checks whether funding goal was reached. 
   * @return Whether funding goal was reached
   */
  function goalReached() public view returns (bool) {
    return weiRaised >= goal;
  }

  function forwardFunds() public payable {
    weiRaised = weiRaised.add(msg.value);    
    vault.deposit.value(msg.value)(msg.sender);
  }
}
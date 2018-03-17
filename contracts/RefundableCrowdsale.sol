pragma solidity ^0.4.18;

import '../utils/RefundVault.sol';
import '../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol';


/**
 * @title RefundableCrowdsale
 * @dev Extension of Crowdsale contract that adds a funding goal, and
 * the possibility of users getting a refund if goal is not met.
 * Uses a RefundVault as the crowdsale's vault.
 */
contract RefundableCrowdsale is Ownable {
  using SafeMath for uint256;

  // minimum amount of funds to be raised in weis
  uint256 public goal;

  // amount of raised money in wei
  uint256 public weiRaised;

  // refund vault used to hold funds while crowdsale is running
  RefundVault public vault;

  /**
   * @dev Constructor, creates RefundVault. 
   * @param _goal Funding goal
   */
  function RefundableCrowdsale(address _wallet, uint256 _goal) public {
      require(_goal > 0);
      require(_wallet != address(0));

      goal = _goal;

      vault = new RefundVault(_wallet);
  }

  /**
   * @dev Investors can claim refunds here if crowdsale is unsuccessful
   */
  function claimRefund() public {
    require(!vault.isActive());
    require(!goalReached());

    vault.refund(msg.sender);
  }

  /**
   * @dev Checks whether funding goal was reached. 
   * @return Whether funding goal was reached
   */
  function goalReached() public view returns (bool) {
    return weiRaised >= goal;
  }

  /**
   * @dev Vault finalization task, called when owner calls finalize()
   */
  function finalize() internal onlyOwner {
    require(vault.isActive());

    if (goalReached()) {
      vault.close();
    } else {
      vault.enableRefunds();
    }
  }

  /**
   * @dev Overrides Crowdsale fund forwarding, sending funds to vault.
   */
  function forwardFunds() internal {
    weiRaised = weiRaised.add(msg.value);    
    vault.deposit.value(msg.value)(msg.sender);
  }

}
pragma solidity ^0.4.23;

import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';


/**
 * @title RefundVault
 * @dev This contract is used for storing funds while a crowdsale
 * is in progress. Supports refunding the money if crowdsale fails,
 * and forwarding it if crowdsale is successful.
 */
contract RefundVault is Ownable {
  using SafeMath for uint256;

  mapping (address => uint256) public deposited;

  event Refunded(address indexed beneficiary, uint256 weiAmount);

  function() public payable {}

  /**
   * @param _investor Investor address
   */
  function deposit(address _investor, uint256 _amount) onlyOwner public payable {
    require(_investor != address(0));

    deposited[_investor] = deposited[_investor].add(_amount);
  }

  /**
   * @param _investor Investor address
   */
  function refund(address _investor) public onlyOwner {
    require(address(this).balance > 0);

    uint256 depositedValue = deposited[_investor];
    require(depositedValue > 0);
    
    deposited[_investor] = 0;
    _investor.transfer(depositedValue);
    emit Refunded(_investor, depositedValue);
  }
}
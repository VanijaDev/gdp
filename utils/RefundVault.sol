pragma solidity ^0.4.19;

import '../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol';


/**
 * @title RefundVault
 * @dev This contract is used for storing funds while a crowdsale
 * is in progress. Supports refunding the money if crowdsale fails,
 * and forwarding it if crowdsale is successful.
 */
contract RefundVault is Ownable {
  using SafeMath for uint256;

  mapping (address => uint256) public deposited;
  address public wallet;

  event Refunded(address indexed beneficiary, uint256 weiAmount);
  event FundsTransferredtoWallet();

  /**
   * @param _wallet Vault address
   */
  function RefundVault(address _wallet) public {
    require(_wallet != address(0));
    wallet = _wallet;
  }

  /**
   * @param investor Investor address
   */
  function deposit(address investor) onlyOwner public payable {
    deposited[investor] = deposited[investor].add(msg.value);
  }

  function moveFundsToWallet() public onlyOwner {
    wallet.transfer(this.balance);
    FundsTransferredtoWallet();
  }

  /**
   * @param investor Investor address
   */
  function refund(address investor) public onlyOwner {
    uint256 depositedValue = deposited[investor];
    require(depositedValue > 0);
    
    deposited[investor] = 0;
    investor.transfer(depositedValue);
    Refunded(investor, depositedValue);
  }
}
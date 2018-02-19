pragma solidity ^0.4.18;

import "./GDPToken.sol";

contract GDPCrowdsale {
  
  // The token being sold
  GDPToken public token;

  // start and end timestamps where investments are allowed (both inclusive)
  uint256[] public startTime;
  uint256[] public endTime;

  // address where funds are collected
  address public wallet;

  /** 
    * how many token units a buyer gets per wei
    * @dev includes pre-ICO (0 element) and ICO stages
  */
  uint256[] public rate; // tokens per ether

  // amount of raised money in wei
  uint256 public weiRaised;

  function GDPCrowdsale(uint256[] _startTime, uint256[] _endTime, uint256[] _rate, address _wallet) public {
    require(validateStartTimeAndEndTime(_startTime, _endTime, now));
    require(validateRate(_rate, _startTime.length));
    require(_wallet != address(0));

    token = createTokenContract();
    startTime = _startTime;
    endTime = _endTime;
    wallet = _wallet;
    rate = _rate;
  }

  /**
    * PUBLIC
   */

   function crowdsaleStagesCount() public view returns(uint) {
     return rate.length;
   }

  /**
    * PRIVATE
  */

  // validate start and end time pairs
  function validateStartTimeAndEndTime(uint256[] _startTime, uint256[] _endTime, uint _now) private pure returns(bool valid) {
    uint length = _startTime.length;

    //  length must be qual
    if(_endTime.length != length) {
      valid = false;
    }

    //  startTime must be less, than now && less than endTime in each pair
    for (uint i = 0; i < length; i ++) {
      if(_startTime[i] < _now || _startTime[i] >= _endTime[i]) {
        valid = false;
      }

      valid = true;
    }
  }

  // validate each element
  function validateRate(uint256[] _rate, uint _validLength) private pure returns(bool valid) {
     uint length = _rate.length;

    if(length != _validLength) {
      valid = false;
    }

    for(uint i = 0; i < length; i ++) {
      if(_rate[i] <= 0) {
        valid = false;
      }
    }

    valid = true;

  }

  // creates the token to be sold.
  function createTokenContract() private returns (GDPToken) {
    return new GDPToken();
  }

}

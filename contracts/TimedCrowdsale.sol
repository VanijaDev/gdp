pragma solidity ^0.4.23;

import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';


contract TimedCrowdsale is Ownable {
  uint256 public openingTime;
  uint256 public closingTime;

  /**
   * @dev Reverts if not in crowdsale time range. 
   */
  modifier onlyWhileOpen {
    require(now >= openingTime && now <= closingTime);
    _;
  }

  /**
   * @dev Constructor, takes crowdsale opening and closing times.
   * @param _openingTime Crowdsale opening time
   * @param _closingTime Crowdsale closing time
   */
  constructor(uint256 _openingTime, uint256 _closingTime) public {
    require(_openingTime >= now);
    require(_closingTime > _openingTime);

    openingTime = _openingTime;
    closingTime = _closingTime;
  }

  function hasStarted() public view returns (bool) {
    return now >= openingTime;
  }

  function timeOver() public view returns (bool) {
    return now > closingTime;
  }

  function updateOpeningTime(uint256 _openingTime) public onlyOwner {
      require(now < openingTime);
      require(_openingTime > now);
      require(_openingTime < closingTime);  //  update closing time first if needed also

      openingTime = _openingTime;
  }

  function updateClosingTime(uint256 _closingTime) public onlyOwner {
      require(_closingTime > openingTime);

      closingTime = _closingTime;
  }

}
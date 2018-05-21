pragma solidity ^0.4.23;

import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';

/**
 * @title PausableCrowdsale
 * @dev Extension of Crowdsale where an owner can pause crowdsale
 */

contract PausableCrowdsale is Ownable {

    bool public isPaused;

/**
 * EVENTS
 */
    event CrowdsalePaused();
    event CrowdsaleRestored();
/**
 * MODIFIERS
 */
    modifier isNotPaused() {
        require(!isPaused);
        _;
    }

/**
 * PUBLIC
 */
    function pauseCrowdsale() public onlyOwner {
        isPaused = true;
        emit CrowdsalePaused();
    }

    function restoreCrowdsale() public onlyOwner {
        isPaused = false;
        emit CrowdsaleRestored();
    }
  
}

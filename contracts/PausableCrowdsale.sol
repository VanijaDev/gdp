pragma solidity ^0.4.18;

import '../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol';

/**
 * @title PausableCrowdsale
 * @dev Extension of Crowdsale where an owner can pause crowdsale
 */

contract PausableCrowdsale is Ownable {

    bool public isPaused;

    event CrowdsalePaused();
    event CrowdsaleRestored();

    modifier isNotPaused() {
        require(!isPaused);
        _;
    }

    function pauseCrowdsale() public onlyOwner {
        isPaused = true;
        CrowdsalePaused();
    }

    function restoreCrowdsale() public onlyOwner {
        isPaused = false;
        CrowdsaleRestored();
    }
  
}

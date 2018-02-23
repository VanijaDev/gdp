let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");
let IncreaseTime = require('../test/helpers/increaseTime');
let LatestTime = require('../test/helpers/latestTime');

const STAGE_LENGTH = IncreaseTime.duration.days(2); // 2 days
const WALLET_ADDR = web3.eth.accounts[9];
const RATES = [3000, 2200, 2000, 1800];

let startTimes = [];
let endTimes = [];

console.log('   INSIDE:    ' + web3.eth.getBlock('latest').timestamp);
console.log('   OTSIDE:    ' + LatestTime.latestTime());

// function GDPCrowdsale(uint256[] _startTimes, uint256[] _endTimes, uint256[] _rates, address _wallet) public {
module.exports = function (deployer) {
    deployer.deploy(GDPCrowdsale, [11111111111111, 22222222222222, 33333333333333, 44444444444444], [11111111111112, 22222222222223, 33333333333334, 44444444444445], RATES, WALLET_ADDR);
};
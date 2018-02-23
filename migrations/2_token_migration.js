let GDPToken = artifacts.require("./GDPToken.sol");
let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");

const IncreaseTime = require('../test/helpers/increaseTime');

module.exports = function (deployer) {
    const RATES = [3000, 2200, 2000, 1800];
    const STAGE_LENGTH = IncreaseTime.duration.days(2); // 2 days
    const WALLET = web3.eth.accounts[9];

    let startTimes = [];
    let endTimes = [];

    //  construct stages and rates
    let latestTime = web3.eth.getBlock('latest').timestamp;

    for (let i = 0; i < RATES.length; i++) {
        if (i == 0) {
            startTimes.push(latestTime + 1);
            endTimes.push(latestTime + 1 + STAGE_LENGTH);
        } else {
            startTimes.push(endTimes[i - 1] + 1);
            endTimes.push(startTimes[i] + STAGE_LENGTH);
        }
    }

    return deployer.deploy(GDPCrowdsale, startTimes, endTimes, RATES, WALLET);
};
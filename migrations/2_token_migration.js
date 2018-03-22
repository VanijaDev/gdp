let GDPToken = artifacts.require("./GDPToken.sol");
let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");
let IncreaseTime = require('../test/helpers/increaseTime');

module.exports = function (deployer, network, accounts) {
    const BASIC_RATE = 1800;
    const BONUSES = [40, 30, 20, 0]; //  in %
    const STAGE_LENGTH = IncreaseTime.duration.minutes(5);
    const WALLET = accounts[0];
    const SOFT_CAP = 1000; // in ETH;

    let whitelist = [];

    // IMPORTANT: TESTING ONLY.You need to provide start and end time.
    let timestamp = 0000000000; //  IMPORTANT: update this value

    if (network != 'ropsten') {
        timestamp = web3.eth.getBlock('latest').timestamp + 1;
        whitelist = [web3.eth.accounts[1], web3.eth.accounts[2]];
    }

    const times = calculateStartEndTimes(timestamp, BONUSES, STAGE_LENGTH);
    let start = times[0];
    let end = times[1];

    console.log('\ntimestamp, STAGE_LENGTH: ', timestamp, STAGE_LENGTH);
    console.log('start: ', start);
    console.log('end: ', end);
    console.log('BASIC_RATE, BONUSES, whitelist, WALLET, SOFT_CAP:   ', BASIC_RATE, BONUSES, whitelist, WALLET, SOFT_CAP, '\n\n\n');

    deployer.deploy(GDPToken).then(async () => {
        let token = await GDPToken.deployed();

        await deployer.deploy(GDPCrowdsale, start, end, BASIC_RATE, BONUSES, [], WALLET, SOFT_CAP, token.address);
        let ico = await GDPCrowdsale.deployed();

        //  transfer ownership to crowdsale
        await token.transferOwnership(ico.address);

        //  add whitelist
        await ico.addToWhitelist(whitelist);
    });
};

/**
 * next stage should start on the next second, when previous stage has ended
 * 
 * @param {uint} latestTime - time of the current block
 * @param {[uint]} bonuses - bonuses for stages
 * @param {uint} stageLength - lenght of each stage
 */
function calculateStartEndTimes(latestTime, bonuses, stageLength) {
    let startTimes = [];
    let endTimes = [];

    for (let i = 0; i < bonuses.length; i++) {
        if (i == 0) {
            startTimes.push(latestTime);
            endTimes.push(latestTime + stageLength);
        } else {
            startTimes.push(endTimes[i - 1] + 1);
            endTimes.push(startTimes[i] + stageLength);
        }
    }

    return [startTimes, endTimes];
}
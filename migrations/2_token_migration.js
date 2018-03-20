/**
 * ASYNC WAY
 */

/*
let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");
const IncreaseTime = require('../test/helpers/increaseTime');

module.exports = function (deployer, network, accounts) {

    const RATES = [3000, 2200, 2000, 1800];
    const WALLET = accounts[0];
    let START_TIMES = []; //  172800
    let END_TIMES = [];

    deployer.then(() => {
        return new Promise((accept, reject) => {
            web3.eth.getBlock('latest', (err, res) => {
                if (err) {
                    return reject(err);
                }

                accept(res);
            });
        });
    }).then((block) => {
        if (block) {
            const timestamp = block.timestamp;
            const RATES = [3000, 2200, 2000, 1800];
            const STAGE_LENGTH = IncreaseTime.duration.days(2);
            const WALLET = accounts[0];
            console.log('1:   ', timestamp, RATES, STAGE_LENGTH, WALLET);

            const times = calculateStartEndTimes(timestamp, RATES, STAGE_LENGTH);

            const start = times[0];
            const end = times[1];

            console.log('2:   ', start, end, RATES, WALLET);

            return deployer.deploy(GDPCrowdsale, start, end, RATES, WALLET);
        }
    });

};
*/


/**
 * WORKING
 */

let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");
let IncreaseTime = require('../test/helpers/increaseTime');
let LatestTime = require('../test/helpers/latestTime');

module.exports = function (deployer, network, accounts) {
    const BASIC_RATE = 1800;
    const BONUSES = [40, 30, 20, 0]; //  in %
    const STAGE_LENGTH = IncreaseTime.duration.minutes(5);
    const WALLET = accounts[0];
    const SOFT_CAP = 1000; // in ETH;

    let whitelist = [];

    // IMPORTANT:  stages timestamps for TESTING ONLY. You need to provide start and end time.
    let timestamp = 1521567000; //  IMPORTANT: update this value
    let start = [1521567000, 1521567201, 1521567402, 1521567603];
    let end = [1521567200, 1521567401, 1521567602, 1521567803];

    if (network != 'ropsten') {
        timestamp = LatestTime.latestTime();
        whitelist = [web3.eth.accounts[1], web3.eth.accounts[2]];

        const times = calculateStartEndTimes(timestamp, BONUSES, STAGE_LENGTH);

        start = times[0];
        end = times[1];
    }


    console.log('\ntimestamp, STAGE_LENGTH: ', timestamp, STAGE_LENGTH);
    console.log('start: ', start);
    console.log('end: ', end);
    console.log('BASIC_RATE, BONUSES, whitelist, WALLET, SOFT_CAP:   ', BASIC_RATE, BONUSES, whitelist, WALLET, SOFT_CAP);

    // deployer.deploy(GDPCrowdsale, start, end, BASIC_RATE, BONUSES, WALLET, SOFT_CAP).then(async () => {
    //     let ico = await GDPCrowdsale.deployed();

    //     await ico.createTokenContract();
    //     await ico.createWhitelistContract();
    //     await ico.createPausableContract();
    // });
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
            startTimes.push(latestTime + 1);
            endTimes.push(latestTime + 1 + stageLength);
        } else {
            startTimes.push(endTimes[i - 1] + 1);
            endTimes.push(startTimes[i] + stageLength);
        }
    }

    return [startTimes, endTimes];
}
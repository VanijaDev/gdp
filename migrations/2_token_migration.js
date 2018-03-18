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

module.exports = function (deployer, network, accounts) {
    const BASIC_RATE = 1800;
    const BONUSES = [40, 30, 20, 0]; //  in %
    const STAGE_LENGTH = IncreaseTime.duration.days(2);
    const WALLET = accounts[0];
    const SOFT_CAP = web3.toWei(1000, 'ether');

    let timestamp = 00000000000; //  IMPORTANT: update this value
    if (network != 'ropsten') {
        timestamp = web3.eth.getBlock('latest').timestamp;
    }

    const times = calculateStartEndTimes(timestamp, BONUSES, STAGE_LENGTH);

    const start = times[0];
    const end = times[1];

    const whitelist = [web3.eth.accounts[1], web3.eth.accounts[2]];

    // console.log('timestamp, BASIC_RATE, BONUSES, STAGE_LENGTH, WALLET:   ', timestamp, BASIC_RATE, BONUSES, STAGE_LENGTH, WALLET);
    // console.log('start', start);
    // console.log('end', end);

    deployer.deploy(GDPCrowdsale, start, end, BASIC_RATE, BONUSES, whitelist, WALLET, SOFT_CAP, {
        value: web3.toWei(0.1, 'ether')
    }).then(async () => {
        let ico = await GDPCrowdsale.deployed();
        await ico.createTokenContract();
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
            startTimes.push(latestTime + 1);
            endTimes.push(latestTime + 1 + stageLength);
        } else {
            startTimes.push(endTimes[i - 1] + 1);
            endTimes.push(startTimes[i] + stageLength);
        }
    }

    return [startTimes, endTimes];
}
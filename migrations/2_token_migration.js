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
    const RATES = [3000, 2200, 2000, 1800];
    const STAGE_LENGTH = IncreaseTime.duration.days(2);
    const WALLET = accounts[0];

    let timestamp = 00000000000; //  IMPORTANT: update this value
    if (network != 'ropsten') {
        timestamp = web3.eth.getBlock('latest').timestamp;
    }

    const times = calculateStartEndTimes(timestamp, RATES, STAGE_LENGTH);

    const start = times[0];
    const end = times[1];

    // console.log('1:   ', timestamp, RATES, STAGE_LENGTH, WALLET);
    // console.log('start', start);
    // console.log('end', end);

    deployer.deploy(GDPCrowdsale, start, end, RATES, WALLET, {
        value: web3.toWei(0.5, 'ether')
    }).then(async () => {
        let ico = await GDPCrowdsale.deployed();
        await ico.createTokenContract();
    });
};

function calculateStartEndTimes(latestTime, rates, stageLength) {
    let startTimes = [];
    let endTimes = [];

    for (let i = 0; i < rates.length; i++) {
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
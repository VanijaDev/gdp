/**
 * MANUAL SETTINGS
 * 
 */

// let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");

// module.exports = function (deployer, network, accounts) {

//     const START_TIMES = [1519652307, 1519825108, 1519997909, 1520170710]; //  172800
//     const END_TIMES = [1519825107, 1519997908, 1520170709, 1520343510];
//     const RATES = [3000, 2200, 2000, 1800];
//     const WALLET = accounts[0];


//     console.log('1:   ', START_TIMES, END_TIMES, RATES, WALLET);
//     return deployer.deploy(GDPCrowdsale);

// };



/**
 * ASYNC WAY
 */

// let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");
// const IncreaseTime = require('../test/helpers/increaseTime');

// module.exports = function (deployer, network, accounts) {

//     const RATES = [3000, 2200, 2000, 1800];
//     const WALLET = accounts[0];
//     let START_TIMES = []; //  172800
//     let END_TIMES = [];

//     deployer.then(() => {
//         return new Promise((accept, reject) => {
//             web3.eth.getBlock('latest', (err, res) => {
//                 if (err) {
//                     return reject(err);
//                 }

//                 accept(res);
//             });
//         });
//     }).then((block) => {
//         if (block) {
// const timestamp = block.timestamp;
// const RATES = [3000, 2200, 2000, 1800];
// const STAGE_LENGTH = IncreaseTime.duration.days(2);
// const WALLET = accounts[0];
// console.log('1:   ', timestamp, RATES, STAGE_LENGTH, WALLET);

// const times = calculateStartEndTimes(timestamp, RATES, STAGE_LENGTH);

// const start = times[0];
// const end = times[1];

//             console.log('2:   ', start, end, RATES, WALLET);

//             return deployer.deploy(GDPCrowdsale, start, end, RATES, WALLET);
//         }
//     });

// };



/**
 * WORKING
 */

let GDPToken = artifacts.require("./GDPToken.sol");
let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");
let IncreaseTime = require('../test/helpers/increaseTime');

module.exports = function (deployer, network, accounts) {
    deployer.deploy(GDPToken).then(async function () {
        const timestamp = 1519655221;
        const RATES = [3000, 2200, 2000, 1800];
        const STAGE_LENGTH = IncreaseTime.duration.days(2);
        const WALLET = accounts[0];
        console.log('1:   ', timestamp, RATES, STAGE_LENGTH, WALLET);

        const times = calculateStartEndTimes(timestamp, RATES, STAGE_LENGTH);

        const start = times[0];
        const end = times[1];
        console.log('start', start);
        console.log('end', end);

        const token = GDPToken.address;
        console.log('token', token);

        await deployer.deploy(GDPCrowdsale, start, end, RATES, WALLET, token);
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
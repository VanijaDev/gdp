let IncreaseTime = require('./increaseTime');

const START = web3.eth.getBlock('latest').timestamp + IncreaseTime.duration.days(1);
const END = START + IncreaseTime.duration.days(5);

var mock = {
    rate: 1800,
    bonuses: [40, 20, 5],
    stageGoals: [10, 20, 30],
    wallet: web3.eth.accounts[0],
    softCap: 50,
    start: START,
    end: END
};

exports.crowdsaleMock = function () {
    return mock;
}
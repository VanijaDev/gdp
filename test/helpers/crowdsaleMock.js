var mock = {
    rate: 1700,
    stageBonuses: [40, 30, 20, 10, 5],
    stageGoals: [2, 5, 4, 6, 7],
    wallet: web3.eth.accounts[9],
    softCap: 50,
    hardCap: 75
};

exports.crowdsaleMock = function () {
    return mock;
}
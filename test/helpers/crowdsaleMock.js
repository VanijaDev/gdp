var mock = {
    rate: 1700,
    stageBonuses: [40, 20, 5],
    stageGoals: [2, 5, 5, 5, 5],
    wallet: web3.eth.accounts[9],
    softCap: 50,
    hardCap: 75
};

exports.crowdsaleMock = function () {
    return mock;
}
let GDPToken = artifacts.require("./GDPToken.sol");

module.exports = function (deployer) {
    const TOTAL_SUPPLY_LIMIT = 100000000;

    deployer.deploy(GDPToken, TOTAL_SUPPLY_LIMIT);
};
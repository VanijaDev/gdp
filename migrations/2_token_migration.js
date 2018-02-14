let GDPToken = artifacts.require("./GDPToken.sol");

module.exports = function (deployer) {
    deployer.deploy(GDPToken);
};
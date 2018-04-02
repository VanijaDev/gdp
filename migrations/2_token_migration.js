let GDPToken = artifacts.require("./GDPToken.sol");
let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");
let IncreaseTime = require('../test/helpers/increaseTime');

module.exports = function (deployer, network, accounts) {
    const BASIC_RATE = 1800;
    const BONUSES = [40, 20, 5]; //  in %
    const WALLET = accounts[0];
    const SOFT_CAP = 50; // in ETH;
    /**
     * IMPORTANT: this is individual stage goal, not crowdsale parts
     * stage 0 must gather 10 ETH before next
     * stage 1 must gather 20 ETH before next
     * stage 2 must gather 30 ETH before next
     */
    const STAGE_GOALS = [10, 20, SOFT_CAP]; // in ETH

    let start = 11111111111;
    let end = 22222222;

    if (network != 'ropsten') {
        start = web3.eth.getBlock('latest').timestamp + 1;
        end = start + IncreaseTime.duration.days(5);
    }

    console.log('\nstart, end: ', start, end);
    console.log('BASIC_RATE, STAGE_GOALS, BONUSES, WALLET, SOFT_CAP:   ', BASIC_RATE, STAGE_GOALS, BONUSES, WALLET, SOFT_CAP, '\n\n\n');

    deployer.deploy(GDPToken).then(async () => {
        let token = await GDPToken.deployed();
        await deployer.deploy(GDPCrowdsale, start, end, BASIC_RATE, STAGE_GOALS, BONUSES, WALLET, SOFT_CAP, token.address);
        let ico = await GDPCrowdsale.deployed();

        //  transfer ownership to crowdsale
        await token.transferOwnership(ico.address);
    });
};
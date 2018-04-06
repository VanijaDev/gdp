let GDPToken = artifacts.require("./GDPToken.sol");
let GDPCrowdsale = artifacts.require("./GDPCrowdsale.sol");
let IncreaseTime = require('../test/helpers/increaseTime');

module.exports = function (deployer, network, accounts) {
    /**
     * PRODUCTION
     */
    let BASIC_RATE = 1700;
    let BONUSES = [40, 30, 20, 10, 5]; //  in %
    let WALLET; //TODO: add wallet from GD
    let SOFT_CAP = 1000; // in ETH;
    let HARD_CAP = 35000; // in ETH;
    let STAGE_GOALS = [2000, 5000, 5000, 5000, 5000]; // in ETH
    let start = 000000;
    let end = 000000;


    /**
     * TEST
     */
    if (network == 'develop') {
        SOFT_CAP = 50;
        HARD_CAP = 75;
        STAGE_GOALS = [2, 5, 5, 5, 5];
        WALLET = accounts[9];
        start = web3.eth.getBlock('latest').timestamp + 10;
        end = start + IncreaseTime.duration.days(5);
    } else if (network == 'ropsten') {
        SOFT_CAP = 5;
        HARD_CAP = 10;
        STAGE_GOALS = [1, 2, 2, 2, 2];
        WALLET = 0x7be996203abfe93b9cf537d3c940f9092664b7c6; //     test wallet;
        start = 000000000;
        end = 00000000;
    }

    console.log('\nstart, end: ', start, end);
    console.log('BASIC_RATE, STAGE_GOALS, BONUSES, WALLET, SOFT_CAP, HARD_CAP:   ', BASIC_RATE, STAGE_GOALS, BONUSES, WALLET, SOFT_CAP, HARD_CAP, '\n\n\n');

    deployer.deploy(GDPToken).then(async () => {
        let token = await GDPToken.deployed();
        await deployer.deploy(GDPCrowdsale, start, end, BASIC_RATE, STAGE_GOALS, BONUSES, WALLET, SOFT_CAP, HARD_CAP, token.address);
        let ico = await GDPCrowdsale.deployed();

        //  transfer ownership to crowdsale
        await token.transferOwnership(ico.address);
    });
};
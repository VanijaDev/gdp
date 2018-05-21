let GDPToken = artifacts.require('./GDPToken.sol');
let GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');

const Asserts = require('./helpers/asserts');
const BigNumber = require('bignumber.js');

contract('GDPToken', (accounts) => {
    const asserts = Asserts(assert);

    let crowdsale;
    let token;

    before('setup', async () => {
        crowdsale = await GDPCrowdsale.deployed();
        token = await GDPToken.at(await crowdsale.token.call());
    });

    describe('initial values', () => {
        it('should validate limit for total supply', async () => {
            const TOTAL_SUPPLY_LIMIT = 100000000; //  use without decimals

            let limit = new BigNumber(await token.totalSupply.call()).toNumber();
            assert.equal(web3.fromWei(limit, 'ether'), TOTAL_SUPPLY_LIMIT, 'limits are different');
        });
    });

});
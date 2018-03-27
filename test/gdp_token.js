let GDPToken = artifacts.require('./GDPToken.sol');
let GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');
const BigNumber = require('bignumber.js');

contract('GDPToken', (accounts) => {

  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);

  let crowdsale;
  let token;

  before('setup', async () => {
    crowdsale = await GDPCrowdsale.deployed();
    token = GDPToken.at(await crowdsale.token.call());
  });

  afterEach('revert', () => {
    reverter.revert;
  });

  describe('initial values', () => {
    it('should validate limit for total supply', async () => {
      const TOTAL_SUPPLY_LIMIT = 100000000; //  use without decimals

      let limit = await token.totalSupply.call();
      assert.equal(web3.fromWei(limit.toNumber(), 'ether'), TOTAL_SUPPLY_LIMIT, 'limits are different');
    });
  });

});
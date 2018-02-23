let GDPToken = artifacts.require('../contracts/GDPToken.sol');
let GDPCrowdsale = artifacts.require('../contracts/GDPCrowdsale.sol');
const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');

contract('GDPToken', (accounts) => {

  let gdp_token;
  const asserts = Asserts(assert);

  before('init', async () => {
    let gdp_crowdsale = await GDPCrowdsale.deployed();
    gdp_token = GDPToken.at(await gdp_crowdsale.token.call());
  });

  afterEach('revert', async () => {
    Reverter.revert;
  });

  describe('initial values', () => {
    it('should validate limit for total supply', async () => {
      const TOTAL_SUPPLY_LIMIT = 100000000; //  use without decimals

      let limit = await gdp_token.totalSupplyLimit.call();
      assert.equal(web3.fromWei(limit.toNumber(), 'ether'), TOTAL_SUPPLY_LIMIT, 'limits are different');
    });
  });

  describe('minting', () => {
    it('should not mint more than limit', async () => {
      const MaxAmount = 100000000;
      const FirstMintAmount = 99000000;
      const DiffMintAmount = 1000000;

      await gdp_token.mint(accounts[1], web3.toWei(FirstMintAmount, "ether"));
      await asserts.throws(gdp_token.mint(accounts[1], web3.toWei(FirstMintAmount, "ether")), 'mint should fail bacause more than limit');
      await asserts.doesNotThrow(gdp_token.mint(accounts[1], web3.toWei(DiffMintAmount, "ether")), 'should be successfully minted');
    });
  });

});
let GDPToken = artifacts.require('./GDPToken.sol');
let GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');

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

      let limit = await token.totalSupplyLimit.call();
      assert.equal(web3.fromWei(limit.toNumber(), 'ether'), TOTAL_SUPPLY_LIMIT, 'limits are different');
    });
  });

  describe('minting', () => {
    it('should not mint more than limit', async () => {
      const MaxAmount = 100000000;
      const FirstMintAmount = 99000000;
      const DiffMintAmount = 1000000;
      let Acc_1 = accounts[1];
      let decimals = await token.decimals.call();

      await crowdsale.manualMint(Acc_1, web3.toWei(FirstMintAmount, "ether"));

      const CorrectBalance_FirstMintAmount = FirstMintAmount * 10 ** decimals;
      assert.equal((await token.balanceOf.call(Acc_1)).toNumber(), CorrectBalance_FirstMintAmount, 'wrong balance after FirstMintAmount');

      await asserts.throws(crowdsale.manualMint(Acc_1, web3.toWei(FirstMintAmount, "ether")), 'mint should fail bacause more than limit');
      await asserts.doesNotThrow(crowdsale.manualMint(Acc_1, web3.toWei(DiffMintAmount, "ether")), 'should be successfully minted');

      const CorrectBalance_LastMintAmount = MaxAmount * 10 ** decimals;
      assert.equal((await token.balanceOf.call(Acc_1)).toNumber(), CorrectBalance_LastMintAmount, 'wrong balance after last mint');

    });
  });

});
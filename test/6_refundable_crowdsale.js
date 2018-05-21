const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');
const RefundVault = artifacts.require('./utils/RefundVault.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');
const IncreaseTime = require('../test/helpers/increaseTime');
const LatestTime = require('../test/helpers/latestTime');
const CrowdsaleMock = require('../test/helpers/crowdsaleMock');
const Chai = require('chai');
var BigNumber = require('bignumber.js');


contract('RefundableCrowdsale', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const ACC_2 = accounts[2];
  const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether'));

  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', async () => {
    crowdsale = await GDPCrowdsale.deployed();
    token = await GDPToken.at(await crowdsale.token.call());
    await IncreaseTime.increaseTimeWith(IncreaseTime.duration.seconds(12));
    await Reverter.snapshot();
  });

  afterEach('revert', async () => {
    await Reverter.revert();
  });

  describe('should perform initial validation', () => {
    it('should validate vault was created', async () => {
      let vaultAddress = await crowdsale.vault.call();
      assert.isTrue(vaultAddress != 0);
    });

    it('should validate refund not allowed', async () => {
      assert.isFalse(await crowdsale.refundEnabled.call());
    });

    it('should validate claimRefund not allowed', async () => {
      await asserts.throws(crowdsale.claimRefund({
        from: ACC_1
      }));
    });

  });
});
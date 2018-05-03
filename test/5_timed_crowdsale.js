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


contract('TimedCrowdsale', (accounts) => {
  const asserts = Asserts(assert);
  let crowdsale;

  before('setup', async () => {
    crowdsale = await GDPCrowdsale.deployed();
    token = await GDPToken.at(await crowdsale.token.call());
    await IncreaseTime.increaseTimeWith(IncreaseTime.duration.seconds(12));
    await Reverter.snapshot();
  });

  afterEach('revert', async () => {
    await Reverter.revert();
  });

  describe('initial validation', () => {
    it('should validate ICO has not closed', async () => {
      assert.isFalse(await crowdsale.timeOver.call(), 'crowdsale should not be closed');
    });

    it('should validate ICO has beed started', async () => {
      assert.isTrue(await crowdsale.hasStarted.call(), 'should be started already');
    });
  });

  describe('should validate stage timing update', () => {
    it('should validate end time update', async () => {
      let latestTime = LatestTime.latestTime();
      let openUp = latestTime + IncreaseTime.duration.days(3);
      let closeUp = openUp + IncreaseTime.duration.days(2);

      await crowdsale.updateClosingTime(closeUp);

      let close = new BigNumber(await crowdsale.closingTime.call()).toFixed();
      assert.equal(close, closeUp, 'closing time is wrong after update');
    });
  });
});
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


contract('PausableCrowdsale', (accounts) => {
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

  describe('initial validation', () => {
    it('should validate ICO is not paused', async () => {
      assert.isFalse(await crowdsale.isPaused.call(), 'crowdsale should not be paused');
    });
  });

  describe('should validate pausable functional', () => {
    it('should validate not owner can not pause', async () => {
      await asserts.throws(crowdsale.pauseCrowdsale.call({
        from: ACC_1
      }), 'should fail, only owner can pause');

      asserts.doesNotThrow(crowdsale.pauseCrowdsale.call(), 'owner should be able to pause');
    });

    it('should validate owner can pause and run again', async () => {
      assert.isFalse(await crowdsale.isPaused.call(), 'should not be paused before test');

      let pauseTx = await crowdsale.pauseCrowdsale();
      let pauseLogs = pauseTx.logs;
      assert.equal(pauseLogs[0].event, 'CrowdsalePaused', 'wrong event, when crowdsale paused');
      assert.isTrue(await crowdsale.isPaused.call(), 'should be paused after owner paused');

      let restoreTx = await crowdsale.restoreCrowdsale();
      let RestoreLogs = restoreTx.logs;
      assert.equal(RestoreLogs[0].event, 'CrowdsaleRestored', 'wrong event, when crowdsale restored');
      assert.isFalse(await crowdsale.isPaused.call(), 'should run after owner run');
    });

    it('should validate tokens can not be bought while paused', async () => {
      await crowdsale.pauseCrowdsale();

      //  buy tokens
      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'purchase can not be performed, while crowdsale is paused');

      //  manual transfer
      await asserts.throws(crowdsale.manualTransfer(0x123, 111), 'manual transfer can not be performed, while crowdsale is paused');
    });
  });

  it('events', async () => {
    it('should get CrowdsalePaused event on pause', async () => {
      let tx = await crowdsale.pauseCrowdsale();

      let events = tx.logs;
      let manualEvent = events[0];

      assert.equal(events.length, 1, 'wrong event count on CrowdsalePaused');
      assert.equal(manualEvent.event, 'CrowdsalePaused', 'wrong event name');
    });
  });
});
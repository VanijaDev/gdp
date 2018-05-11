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


contract('RefundableCrowdsale - new instance', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const ACC_2 = accounts[2];
  const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether'));

  const asserts = Asserts(assert);
  let crowdsaleLocal;
  let tokenLocal;

  before('setup', async () => {
    let mock = CrowdsaleMock.crowdsaleMock();
    let start = web3.eth.getBlock('latest').timestamp + IncreaseTime.duration.days(2);
    let end = start + IncreaseTime.duration.days(5);

    tokenLocal = await GDPToken.new();
    crowdsaleLocal = await GDPCrowdsale.new(start, end, mock.rate, mock.stageGoals, mock.stageBonuses, mock.wallet, mock.softCap, mock.hardCap, tokenLocal.address);
    await tokenLocal.transferOwnership(crowdsaleLocal.address);
    await IncreaseTime.increaseTimeTo(start + IncreaseTime.duration.seconds(12));
    await Reverter.snapshot();
  });

  afterEach('revert', async () => {
    await Reverter.revert();
  });

  describe('should perform initial validation', () => {
    it('should validate vault was created', async () => {
      let vaultAddress = await crowdsaleLocal.vault.call();
      assert.isTrue(vaultAddress != 0);
    });

    it('should validate claimRefund not allowed', async () => {
      await asserts.throws(crowdsaleLocal.claimRefund({
        from: ACC_1
      }));
    });
  });

  describe('refund functional', () => {
    it('should validate refund is NOT AVAILABLE if softcap was reached, but ICO still running by time', async () => {
      let sc = new BigNumber(await crowdsaleLocal.softCap.call());

      await crowdsaleLocal.sendTransaction({
        from: ACC_1,
        value: sc
      });

      await asserts.throws(crowdsaleLocal.claimRefund({
        from: ACC_1
      }));
    });

    it('should validate refund is NOT AVAILABLE if ICO ended by time, but softcap not reached', async () => {
      await crowdsaleLocal.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      await asserts.throws(crowdsaleLocal.claimRefund({
        from: ACC_1
      }));
    });

    it('should validate refund is AVAILABLE if softcap not reached and ICO end running by time', async () => {
      await crowdsaleLocal.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });
      let ACC_1_AFTER_PURCHASE = new BigNumber(await web3.eth.getBalance(ACC_1));

      let endTime = new BigNumber(await crowdsaleLocal.closingTime.call());
      await IncreaseTime.increaseTimeTo((endTime.plus(10)));

      let vault = await crowdsaleLocal.vault.call();
      let wallet = await crowdsaleLocal.wallet.call();

      await web3.eth.sendTransaction({
        from: wallet,
        to: vault,
        value: ACC_1_WEI_SENT
      });

      await asserts.doesNotThrow(crowdsaleLocal.claimRefund({
        from: ACC_1
      }));

      assert.isAbove((await web3.eth.getBalance(ACC_1)).toFixed(), ACC_1_AFTER_PURCHASE, 'wrong funds after refund');
    });

    it('should not let not owner to kill ICO', async () => {
      await asserts.throws(crowdsaleLocal.killContract({
        from: ACC_1
      }), 'not owner can not kill ICO');
    });

    it('should let kill when ICO is being finished', async () => {
      await asserts.doesNotThrow(crowdsaleLocal.killContract(), 'should let kill when ICO is being finished');
    });
  });

  describe('create new crowdsale', () => {
    it('should verify tokens can be burned, when ICO is closed by time', async () => {
      let crowdsaleLocal_1;
      let tokenLocal_1;
      let mock = CrowdsaleMock.crowdsaleMock();
      let start = new BigNumber(await crowdsaleLocal.closingTime.call()).plus(new BigNumber(IncreaseTime.duration.minutes(2)));
      let end = start.plus(new BigNumber(IncreaseTime.duration.days(1))).toFixed();

      tokenLocal_1 = await GDPToken.new();
      crowdsaleLocal_1 = await GDPCrowdsale.new(start, end, mock.rate, mock.stageGoals, mock.stageBonuses, mock.wallet, mock.softCap, mock.hardCap, tokenLocal_1.address);
      await tokenLocal_1.transferOwnership(crowdsaleLocal_1.address);

      await IncreaseTime.increaseTimeTo(end + IncreaseTime.duration.minutes(1));

      await asserts.throws(crowdsaleLocal_1.burnTokens({
        from: ACC_1
      }), 'not owner can not burn tokens');

      await assert.isAbove(new BigNumber(await tokenLocal_1.balanceOf(crowdsaleLocal_1.address)).toFixed(), 0, 'crowdsale should have tokens');

      await asserts.doesNotThrow(crowdsaleLocal_1.burnTokens(), 'owner should be able to burn tokens');
      await assert.equal(new BigNumber(await tokenLocal_1.balanceOf(crowdsaleLocal_1.address)).toFixed(), 0, 'crowdsale balance should be 0');

    });
  });
});
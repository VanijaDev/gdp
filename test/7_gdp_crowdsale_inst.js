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


contract('GDPCrowdsale - new instance', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const asserts = Asserts(assert);
  let crowdsaleLocal;
  let tokenLocal;

  before('setup', async () => {
    let mock = CrowdsaleMock.crowdsaleMock();
    let start = web3.eth.getBlock('latest').timestamp + IncreaseTime.duration.days(1);
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

  describe('burn token', () => {
    it('should verify tokens can be burned, when ICO is closed by time', async () => {
      // IncreaseTime.increaseTimeWith(IncreaseTime.duration.weeks(1));

      // await asserts.throws(crowdsale.burnTokens({
      //   from: ACC_1
      // }), 'not owner can not burn tokens');

      // await assert.isAbove(new BigNumber(await token.balanceOf(crowdsale.address)).toFixed(), 0, 'crowdsale should have tokens');

      // await asserts.doesNotThrow(crowdsale.burnTokens(), 'owner should be able to burn tokens');
      // await assert.equal(new BigNumber(await token.balanceOf(crowdsale.address)).toFixed(), 0, 'crowdsale balance should be 0');

    });
  });

});
const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');
const IncreaseTime = require('../test/helpers/increaseTime');
const LatestTime = require('../test/helpers/latestTime');
const Chai = require('chai');

contract('GDPCrowdsale', (accounts) => {

  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
      return crowdsale.token.call();
    }).then((tokenAddresss) => {
      token = GDPToken.at(tokenAddresss);
    }).then(reverter.snapshot);
  });

  afterEach('revert', reverter.revert);

  describe('initial validation', () => {
    const TOKEN_TOTAL_SUPPLY_LIMIT = 100000000 * 10 ** 18;

    it('validate initial values', async () => {
      let rates = await crowdsale.stagesCount.call();
      assert.equal((await crowdsale.stagesCount.call()).toNumber(), 4, 'wrong ICO stages count');
      assert.notEqual(await crowdsale.token.call(), 0, 'token should be already created');
      assert.isFalse(await crowdsale.hasEnded.call(), 'crowdsale should still go on');
    });

    it('validate newly created token', async () => {
      assert.equal(await token.owner.call(), crowdsale.address, 'wrong token owner address');
      assert.equal(await token.totalSupplyLimit.call(), TOKEN_TOTAL_SUPPLY_LIMIT, 'wrong total supply limit');
    });
  });

  describe('validate purchase', () => {
    const ACC_1 = accounts[1];
    const ACC_1_WEI_SENT = web3.toWei(1, 'ether');

    const ACC_2 = accounts[2];
    const ACC_2_WEI_SENT = web3.toWei(2, 'ether');

    it('validate weiRaised value', async () => {
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.minutes(1));

      //  ACC_1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let correctWeiRaised = parseInt(ACC_1_WEI_SENT);
      let weiRaisedResult = (await crowdsale.weiRaised.call()).toNumber();
      assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount after ACC_1 purchase');

      //  ACC_1 + ACC_2
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      correctWeiRaised = parseInt(ACC_1_WEI_SENT) + parseInt(ACC_2_WEI_SENT);
      weiRaisedResult = (await crowdsale.weiRaised.call()).toNumber();
      assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount after ACC_2 purchase');
    });


    it('validate wallet receives correct ETH amount', async () => {
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.minutes(1));

      let walletFundsBefore = (web3.eth.getBalance(await crowdsale.wallet.call())).toNumber();

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let walletFundsAfter_Acc1 = (web3.eth.getBalance(await crowdsale.wallet.call())).toNumber();
      let diff = walletFundsAfter_Acc1 - walletFundsBefore;
      assert.equal(ACC_1_WEI_SENT, diff, 'wrong funds in wallet after ACC_1 bought tokens');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      let walletFundsAfter_Acc2 = (web3.eth.getBalance(await crowdsale.wallet.call())).toNumber();
      diff = walletFundsAfter_Acc2 - walletFundsAfter_Acc1;
      assert.equal(ACC_2_WEI_SENT, diff, 'wrong funds in wallet after ACC_2 bought tokens');
    });

    it('validate token amount bought for eth', async () => {
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.minutes(1));

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let currentRate = (await crowdsale.currentRate.call()).toNumber();
      let tokensCorrect = ACC_1_WEI_SENT * currentRate;
      let tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount for ACC_1 after purchase');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      currentRate = (await crowdsale.currentRate.call()).toNumber();
      tokensCorrect = ACC_1_WEI_SENT * currentRate * 2;
      tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount for ACC_1 after second purchase');

      //  3
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      currentRate = (await crowdsale.currentRate.call()).toNumber();
      tokensCorrect = ACC_2_WEI_SENT * currentRate;
      tokens = (await token.balanceOf.call(ACC_2)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount for ACC_2 after purchase');

    });
  });

  describe('IMPORTANT: this should be last tests - validate ICO stages', () => {
    const ACC_1 = accounts[1];
    const ACC_1_WEI_SENT = web3.toWei(1, 'ether');

    const ACC_2 = accounts[2];
    const ACC_2_WEI_SENT = web3.toWei(2, 'ether');

    it('can\'t buy tokens before ICO starts', async () => {
      //  TODO: move to separate file (2 places): here and migration file
      const RATES = [3300, 2200, 2000, 1800];
      const STAGE_LENGTH = IncreaseTime.duration.days(2); // 2 days
      const WALLET = web3.eth.accounts[9];

      let startTimes = [];
      let endTimes = [];

      //  construct stages and rates
      let latestTime = LatestTime.latestTime();

      for (let i = 0; i < RATES.length; i++) {
        if (i == 0) {
          startTimes.push(latestTime + IncreaseTime.duration.days(2) + 1);
          endTimes.push(latestTime + IncreaseTime.duration.days(2) + 1 + STAGE_LENGTH);
        } else {
          startTimes.push(endTimes[i - 1] + 1);
          endTimes.push(startTimes[i] + STAGE_LENGTH);
        }
      }

      let localCrowdsale = await GDPCrowdsale.new(startTimes, endTimes, RATES, WALLET, {
        value: web3.toWei(0.1, 'ether')
      });

      await asserts.throws(localCrowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'should not allow to buy before ICO has started');
    });

    it('validate first stage', async () => {
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.minutes(1));

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });
      let tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      const correctTokens = ACC_1_WEI_SENT * (await crowdsale.rates.call(0));
      assert.equal(tokens, correctTokens, 'wrong token amount bought during first stage');
      assert.equal((await crowdsale.weiRaised.call()).toNumber(), ACC_1_WEI_SENT, 'wrong weiRaised amount after ACC_1 purchase');

      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });
      let correctWeiRaised = parseInt(ACC_1_WEI_SENT) + parseInt(ACC_2_WEI_SENT);
      let weiRaisedResult = (await crowdsale.weiRaised.call()).toNumber();
      assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount ACC_1 + ACC_2');
    });

    it('IMPORTANT: should be last test - validate last stage', async () => {
      let stageCount = await crowdsale.stagesCount.call();
      assert.isAtLeast(stageCount, 1, 'there should be at least 1 ICO stage');

      let stageIdx = stageCount - 1;
      let startTime = await crowdsale.startTimes.call(stageIdx);
      // console.log('now:   ', web3.eth.getBlock('latest').timestamp);
      await IncreaseTime.increaseTimeTo(startTime);
      // console.log('now 2:   ', web3.eth.getBlock('latest').timestamp);

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      let rate = await crowdsale.rates.call(stageIdx);
      const correctTokens = ACC_1_WEI_SENT * rate;
      assert.equal(tokens, correctTokens, 'wrong token amount bought during first stage');
      assert.equal((await crowdsale.weiRaised.call()).toNumber(), ACC_1_WEI_SENT, 'wrong weiRaised amount after ACC_1 purchase');
    });

    it('can\'t buy tokens after ICO finishes', async () => {
      let stageCount = await crowdsale.stagesCount.call();
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.weeks(stageCount));

      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'should not allow to buy after ICO has finished');
    });

  });
});
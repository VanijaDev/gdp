const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');
const IncreaseTime = require('../test/helpers/increaseTime');
const LatestTime = require('../test/helpers/latestTime');
const Chai = require('chai');
const BigNumber = require('bignumber.js');

//  TODO: start with should

contract('GDPCrowdsale', (accounts) => {

  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether')).toFixed();

  const ACC_2 = accounts[2];
  const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether')).toFixed();

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

    it('validate stagesCount value', async () => {
      let stages = await crowdsale.stagesCount.call();
      assert.equal(stages, 4, 'wrong stagesCount. Be sure to check migration file.');
    });

    it('pause state', async () => {
      assert.isFalse(await crowdsale.isPaused.call(), 'should not be paused at th beginning');
    });
  });

  describe('pausable functional', () => {
    it('can be set by owner only', async () => {
      await asserts.throws(crowdsale.pauseCrowdsale.call({
        from: ACC_1
      }), 'should fail, only owner can pause');

      asserts.doesNotThrow(crowdsale.pauseCrowdsale.call(), 'owner should be able to pause');
      //  TODO: test logs
    });

    it('owner can pause and run again', async () => {
      assert.isFalse(await crowdsale.isPaused.call(), 'should not be paused before test');

      await crowdsale.pauseCrowdsale();
      assert.isTrue(await crowdsale.isPaused.call(), 'should be paused after owner paused');

      await crowdsale.restoreCrowdsale();
      assert.isFalse(await crowdsale.isPaused.call(), 'should run after owner run');
    });

    it('tokens can not be bought while paused', async () => {
      await crowdsale.pauseCrowdsale();

      //  buy tokens
      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }));

      //  manual mint
      await asserts.throws(crowdsale.manualMint(0x123, 111), 'manual mint can not be performed, while crowdsale is paused.');
    });
  });

  describe('manual minting', () => {
    it('should let owner mint manually', async () => {
      const TOKENS = new BigNumber(web3.toWei(3, 'ether')).toFixed();

      await asserts.doesNotThrow(crowdsale.manualMint(ACC_1, TOKENS));

      let balance = new BigNumber(await token.balanceOf(ACC_1)).toFixed();
      assert.equal(balance, TOKENS, 'wrong token amount after manual mint');
    });

    it('should not let not owner mint manually', async () => {
      const TOKENS = new BigNumber(web3.toWei(3, 'ether')).toFixed();

      await asserts.throws(crowdsale.manualMint(ACC_1, TOKENS, {
        from: ACC_1
      }));
    });
  });

  describe('validate purchase', () => {
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
      let wallet = await crowdsale.wallet.call();

      let walletFundsBefore = (web3.eth.getBalance(wallet)).toNumber();

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let walletFundsAfter_Acc1 = (web3.eth.getBalance(wallet)).toNumber();
      let diff = walletFundsAfter_Acc1 - walletFundsBefore;
      assert.equal(ACC_1_WEI_SENT, diff, 'wrong funds in wallet after ACC_1 bought tokens');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      let walletFundsAfter_Acc2 = (web3.eth.getBalance(wallet)).toNumber();
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

  describe('whitelist', () => {
    it('should show address is whitelisted', async () => {
      assert.isTrue(await crowdsale.isWhitelisted.call(OWNER), 'owner should be whitelisted');
      assert.isTrue(await crowdsale.isWhitelisted.call(ACC_1), 'ACC_1 was set to be whitelisted');
    });

    it('should show if address is not in whitelist', async () => {
      assert.isFalse(await crowdsale.isWhitelisted.call(web3.eth.accounts[7]), 'account 7 should not be whitelisted');
    });

    it('should allow owner to add to whitelst', async () => {
      const ACC_9 = web3.eth.accounts[8];

      assert.isFalse(await crowdsale.isWhitelisted.call(ACC_9), 'ACC_9 should not be in whitelist');

      await crowdsale.addToWhitelist([ACC_9]);
      assert.isTrue(await crowdsale.isWhitelisted.call(ACC_9), 'ACC_9 should be whitelisted after adding to whitelist');
    });

    it('should allow owner to remove from whitelst', async () => {
      assert.isTrue(await crowdsale.isWhitelisted.call(ACC_1), 'ACC_1 should be in whitelist');

      await crowdsale.removeFromWhitelist([ACC_1]);
      assert.isFalse(await crowdsale.isWhitelisted.call(ACC_1), 'ACC_1 should not be whitelisted after removing from whitelist');
    });

    it('should restrict not owner to modify whitelist', async () => {
      await asserts.throws(crowdsale.addToWhitelist([ACC_1], {
        from: ACC_1
      }));
      await asserts.throws(crowdsale.removeFromWhitelist([ACC_1], {
        from: ACC_2
      }));
    });

    it('should let whitelisted address to purchase', async () => {
      const WEI = web3.toWei(3, 'ether');

      await asserts.doesNotThrow(crowdsale.sendTransaction({
        value: WEI
      }), 'owner should be able to buy');

      const ACC_9 = web3.eth.accounts[8];
      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_9,
        value: WEI
      }), 'ACC_9 is not whitelisted, so should not be able to buy yet');
      await crowdsale.addToWhitelist([ACC_9]);
      await asserts.doesNotThrow(crowdsale.sendTransaction({
        value: WEI
      }), 'ACC_9 is whitelisted, so should be able to buy');
    });

    it('should restrict address not in whitelisted from purchase', async () => {
      const WEI = web3.toWei(3, 'ether');
      const ACC_8 = web3.eth.accounts[7];

      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_8,
        value: WEI
      }));
    });
  });

  describe('should validate crowdsale stages updates', () => {
    it('should validate rate value after stages update', async () => {
      //  create new times
      let latestTime = LatestTime.latestTime();
      let startTimesUpdated = [latestTime + 100, latestTime + 200, latestTime + 300, latestTime + 400];
      let endTimesUpdated = [latestTime + 199, latestTime + 299, latestTime + 399, latestTime + 499];

      await crowdsale.updateCrowdsaleStages(startTimesUpdated, endTimesUpdated);

      //  1
      let stage1_start_updated = new BigNumber(await crowdsale.startTimes.call(1)).toFixed();
      assert.equal(stage1_start_updated, startTimesUpdated[1], 'stage 1 start was not updated properly');

      //  2
      let stage1_end_updated = new BigNumber(await crowdsale.endTimes.call(1)).toFixed();
      assert.equal(stage1_end_updated, endTimesUpdated[1], 'stage 1 end was not updated properly');

      //  3
      let stage3_start_updated = new BigNumber(await crowdsale.startTimes.call(3)).toFixed();
      assert.equal(stage3_start_updated, startTimesUpdated[3], 'stage 3 was not updated properly');
    });

    it('should validate finish time update', async () => {
      let stagesCount = (await crowdsale.stagesCount.call()).toNumber();
      let currentFinishTime = (await crowdsale.endTimes.call(stagesCount - 1)).toNumber();

      let updatedFinishTime = currentFinishTime + 2000;
      await crowdsale.updateCrowdsaleFinishTime(updatedFinishTime);

      let finishTimeAfterUpdate = (await crowdsale.endTimes.call(stagesCount - 1)).toNumber();
      assert.equal(finishTimeAfterUpdate, updatedFinishTime, 'crowdsale finish time is wrond after update');
    });
  });

  /**
   * IMPORTANT: this should be last tests
   */
  describe('validate ICO stages', () => {
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

      let localCrowdsale = await GDPCrowdsale.new(startTimes, endTimes, RATES, WALLET, [], {
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
      let stageCount = (await crowdsale.stagesCount.call()).toNumber();
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.weeks(stageCount));

      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'should not allow to buy after ICO has finished');
    });

  });
});
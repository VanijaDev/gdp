const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');
const RefundVault = artifacts.require('./utils/RefundVault.sol');

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
    });

    it('owner can pause and run again', async () => {
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

    it('tokens can not be bought while paused', async () => {
      await crowdsale.pauseCrowdsale();

      //  buy tokens
      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'purchase can not be performed, while crowdsale is paused');

      //  manual mint
      await asserts.throws(crowdsale.manualMint(0x123, 111), 'manual mint can not be performed, while crowdsale is paused');
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

  describe('validate purchase', () => {
    it('validate weiRaised value', async () => {
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

    it('validate token amount bought for eth', async () => {
      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let basicRate = (await crowdsale.basicRate.call()).toNumber();
      let basicAmount = ACC_1_WEI_SENT * basicRate;
      let bonus = (await crowdsale.currentStageBonus.call()).toNumber();
      let bonusAmount = basicAmount * bonus / 100;
      let tokensCorrect = basicAmount + bonusAmount;
      let tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount for ACC_1 after purchase');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      tokensCorrect = (tokensCorrect * 2);
      tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount for ACC_1 after second purchase');

      //  3
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      basicAmount = ACC_2_WEI_SENT * basicRate;
      bonusAmount = basicAmount * bonus / 100;
      tokensCorrect = basicAmount + bonusAmount;
      tokens = (await token.balanceOf.call(ACC_2)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount for ACC_2 after purchase');

    });
  });

  describe('vault', () => {
    it('validate vault receives correct ETH amount', async () => {
      let vaultAddr = await crowdsale.vault.call();
      let vaultFundsBefore = (web3.eth.getBalance(vaultAddr)).toNumber();

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let vaultFundsAfter_Acc1 = (web3.eth.getBalance(vaultAddr)).toNumber();
      let diff = vaultFundsAfter_Acc1 - vaultFundsBefore;
      assert.equal(ACC_1_WEI_SENT, diff, 'wrong funds in vault after ACC_1 bought tokens');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      let vaultFundsAfter_Acc2 = (web3.eth.getBalance(vaultAddr)).toNumber();
      diff = vaultFundsAfter_Acc2 - vaultFundsAfter_Acc1;
      assert.equal(ACC_2_WEI_SENT, diff, 'wrong funds in vault after ACC_2 bought tokens');
    });

    it('validate correct value in deposits for each investor', async () => {
      let vaultAddr = await crowdsale.vault.call();
      let vault = await RefundVault.at(vaultAddr);

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let vaultDepositAcc1 = new BigNumber(await vault.deposited.call(ACC_1)).toFixed();
      assert.equal(vaultDepositAcc1, ACC_1_WEI_SENT, 'wrong ACC_1 deposit in vault after purchase');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      let vaultDepositAcc2 = new BigNumber(await vault.deposited.call(ACC_2)).toFixed();
      assert.equal(vaultDepositAcc2, ACC_2_WEI_SENT, 'wrong ACC_2 deposit in vault after purchase');

      //  3
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let vaultDepositAcc1_2 = new BigNumber(await vault.deposited.call(ACC_1)).toFixed();
      assert.equal(vaultDepositAcc1_2, (ACC_1_WEI_SENT * 2), 'wrong ACC_1 deposit in vault after second purchase');

      //  4
      let vaultDepositAcc4 = new BigNumber(await vault.deposited.call(web3.eth.accounts[3])).toFixed();
      assert.equal(vaultDepositAcc4, 0, 'wrong ACC_4 deposit in vault, should be 0');
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
      const BASIC_RATE = 1800;
      const BONUSES = [40]; //  in %
      const STAGE_LENGTH = IncreaseTime.duration.days(2);
      const WALLET = accounts[0];
      const SOFT_CAP = web3.toWei(1000, 'ether');

      let latestTime = LatestTime.latestTime();

      let startTimes = [latestTime + STAGE_LENGTH];
      let endTimes = [startTimes[0] + STAGE_LENGTH];

      let localCrowdsale = await GDPCrowdsale.new(startTimes, endTimes, BASIC_RATE, BONUSES, [], WALLET, SOFT_CAP, {
        value: web3.toWei(0.1, 'ether')
      });
      await localCrowdsale.createTokenContract();

      await asserts.throws(localCrowdsale.sendTransaction({
        value: ACC_1_WEI_SENT
      }), 'should not allow to buy before ICO has started');
    });

    it('validate first stage', async () => {
      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let basicRate = (await crowdsale.basicRate.call()).toNumber();
      let basicAmount = ACC_1_WEI_SENT * basicRate;
      let bonus = (await crowdsale.currentStageBonus.call()).toNumber();
      let bonusAmount = basicAmount * bonus / 100;
      let tokensCorrect = basicAmount + bonusAmount;
      let tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount bought during first stage');
      assert.equal((await crowdsale.weiRaised.call()).toNumber(), ACC_1_WEI_SENT, 'wrong weiRaised amount after ACC_1 purchase');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });
      let correctWeiRaised = parseInt(ACC_1_WEI_SENT) + parseInt(ACC_2_WEI_SENT);
      let weiRaisedResult = (await crowdsale.weiRaised.call()).toNumber();
      assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount ACC_1 + ACC_2');
    });

    it('validate last stage', async () => {
      let stageCount = await crowdsale.stagesCount.call();
      assert.isAtLeast(stageCount, 1, 'there should be at least 1 ICO stage');

      let stageIdx = stageCount - 1;
      let startTime = (await crowdsale.startTimes.call(stageIdx)).toNumber();
      // console.log('now:   ', web3.eth.getBlock('latest').timestamp);
      await IncreaseTime.increaseTimeTo(startTime);
      // console.log('now 2:   ', web3.eth.getBlock('latest').timestamp);

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let basicRate = (await crowdsale.basicRate.call()).toNumber();
      let basicAmount = ACC_1_WEI_SENT * basicRate;
      let bonus = (await crowdsale.currentStageBonus.call()).toNumber();
      let bonusAmount = basicAmount * bonus / 100;
      let tokensCorrect = basicAmount + bonusAmount;
      let tokens = (await token.balanceOf.call(ACC_1)).toNumber();

      assert.equal(tokens, tokensCorrect, 'wrong token amount bought during first stage');
      assert.equal((await crowdsale.weiRaised.call()).toNumber(), ACC_1_WEI_SENT, 'wrong weiRaised amount after ACC_1 purchase');
    });

    it('IMPORTANT: should be last test - should validate, crowdsale finish', async () => {
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.days(10));

      //  1
      await asserts.throws(crowdsale.forwardFundsToWallet(), 'tokens can not be transfered to walled if ICO was unsuccessfull');

      //  2
      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'should not allow purchase after ICO finished');

      //  3
      let vaultAddr = await crowdsale.vault();
      let vault = await RefundVault.at(vaultAddr);
      assert.isTrue(await crowdsale.hasEnded.call(), 'crowdsale should be ended before check');
      assert.isFalse(await crowdsale.goalReached.call(), 'goal should not be reached');

      //  4
      let acc1BalanceBefore = (await web3.eth.getBalance(ACC_1)).toNumber();
      assert.equal(new BigNumber(await vault.deposited.call(ACC_1)).toFixed(), ACC_1_WEI_SENT, 'wrong vault deposit for ACC_1 before refund');

      await crowdsale.claimRefund({
        from: ACC_1
      });
      let acc1BalanceAfter = (await web3.eth.getBalance(ACC_1)).toNumber();
      assert.isAbove(acc1BalanceAfter, acc1BalanceBefore, 'balance after refund must be more, then before');
      assert.equal((await vault.deposited.call(ACC_1)).toNumber(), 0, 'wrong vault deposit for ACC_1 after refund');

      //  5
      await asserts.throws(crowdsale.claimRefund({
        from: ACC_1
      }), 'refund can not be claimed multiple times');

    });
  });

  describe('goal reached - new crowdsale for test', () => {
    it('should validate goal is being reached', async () => {
      const BASIC_RATE = 1800;
      const BONUSES = [40]; //  in %
      const STAGE_LENGTH = IncreaseTime.duration.days(2);
      const WALLET = accounts[0];
      const SOFT_CAP = web3.toWei(10, 'ether');

      let latestTime = LatestTime.latestTime();

      let startTimes = [latestTime + 11111111];
      let endTimes = [startTimes[0] + STAGE_LENGTH];

      let localCrowdsale1 = await GDPCrowdsale.new(startTimes, endTimes, BASIC_RATE, BONUSES, [ACC_1], WALLET, SOFT_CAP, {
        value: web3.toWei(0.1, 'ether')
      });
      await localCrowdsale1.createTokenContract();

      await IncreaseTime.increaseTimeTo(startTimes[0] + 1);

      await localCrowdsale1.sendTransaction({
        from: ACC_1,
        value: SOFT_CAP
      });

      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.days(3));

      //  1
      let vaultAddr = await localCrowdsale1.vault();
      let vault = await RefundVault.at(vaultAddr);
      assert.isTrue(await localCrowdsale1.hasEnded.call(), 'localCrowdsale1 should be ended before check');
      assert.isTrue(await localCrowdsale1.goalReached.call(), 'goal should not be reached');

      //  2
      await asserts.throws(crowdsale.claimRefund({
        from: ACC_1
      }), 'refund can not be claimed if ICO was successfull');

      //  3
      await asserts.throws(crowdsale.forwardFundsToWallet({
        from: ACC_1
      }), 'tokens shoould be transfered to walled by owner only');

      //  4
      await asserts.throws(crowdsale.forwardFundsToWallet(), 'tokens shoould be transfered to walled if ICO was successfull');

    });
  });
});
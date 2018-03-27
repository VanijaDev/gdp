const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');
const RefundVault = artifacts.require('./utils/RefundVault.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');
const IncreaseTime = require('../test/helpers/increaseTime');
const LatestTime = require('../test/helpers/latestTime');
const Chai = require('chai');
var BigNumber = require('bignumber.js');

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
    }).then(() => {
      IncreaseTime.increaseTimeWith(1);
    }).then(reverter.snapshot);
  });

  afterEach('revert', reverter.revert);

  describe('initial validation', () => {
    const TOKEN_TOTAL_SUPPLY_LIMIT = 100000000 * 10 ** 18;

    it('validate basic rate', async () => {
      assert.equal((await crowdsale.basicRate.call()).toNumber(), 1800, 'wrong basicRate');
    });

    it('validate ICO stages count', async () => {
      assert.equal((await crowdsale.stagesCount.call()).toNumber(), 4, 'wrong ICO stages count');
    });

    it('validate token was created', async () => {
      assert.notEqual(await crowdsale.token.call(), 0, 'token should be already created');
    });

    it('validate ICO is not paused', async () => {
      assert.isFalse(await crowdsale.hasEnded.call(), 'crowdsale should still go on');
    });

    it('validate owner ownes total supply', async () => {
      assert.equal(new BigNumber(await token.balanceOf.call(crowdsale.address)).toFixed(), new BigNumber(await token.totalSupply.call()).toFixed(), 'owner should own total supply');
    });

    it('validate token amount for crowdsale purchases amount', async () => {
      let icoPercent = await crowdsale.icoTokensReservedPercent.call();
      const reservedValidation = new BigNumber(await token.totalSupply.call() / 100 * icoPercent).toFixed();
      let reserved = new BigNumber(await crowdsale.icoTokensReserved.call()).toFixed();
      assert.equal(reserved, reservedValidation, 'wrong amount of icoTokensReserved');
    });

    it('validate token amount for manual transfer', async () => {
      let icoPercent = await crowdsale.icoTokensReservedPercent.call();
      let manualTransferPercent = 100 - icoPercent;
      const manualTransferValidation = new BigNumber(await token.totalSupply.call() / 100 * manualTransferPercent).toFixed();
      let manualTransfer = new BigNumber(await crowdsale.manualTokensTransferReserved.call()).toFixed();
      assert.equal(manualTransfer, manualTransferValidation, 'wrong amount of manual transfer');
    });

    it('validate newly created token\'s owner', async () => {
      assert.equal(await token.owner.call(), crowdsale.address, 'wrong token owner address');
    });

    it('validate pause state', async () => {
      assert.isFalse(await crowdsale.isPaused.call(), 'should not be paused at th beginning');
    });

    it('validate token limit value for ico purchase', async () => {
      let totalSupply = new BigNumber(await token.totalSupply.call()).toFixed();
      let purchaseLimitInPercent = new BigNumber(await crowdsale.icoTokensReservedPercent.call()).toFixed();
      let purchaseLimit = new BigNumber(await crowdsale.icoTokensReserved.call()).toFixed();

      assert.equal(new BigNumber(totalSupply / 100 * purchaseLimitInPercent).toFixed(), purchaseLimit, 'wrong purchase token limit');
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

      //  manual transfer
      await asserts.throws(crowdsale.manualTransfer(0x123, 111), 'manual transfer can not be performed, while crowdsale is paused');
    });
  });

  describe('manual transfer', () => {
    it('should let owner transfer manually', async () => {
      const TOKENS = new BigNumber(web3.toWei(3, 'ether')).toFixed();
      let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

      await asserts.doesNotThrow(crowdsale.manualTransfer(ACC_1, TOKENS));

      let balance = new BigNumber(await token.balanceOf(ACC_1));
      assert.equal(balance, TOKENS, 'wrong token amount after manual transfer');

      let crowdsaleTokensAfterTransfer = new BigNumber(await token.balanceOf.call(crowdsale.address));
      assert.equal(balance, new BigNumber(crowdsaleTokens.minus(crowdsaleTokensAfterTransfer)).toFixed(), 'wrong token amount substracted');
    });

    it('should not let not owner transfer manually', async () => {
      const TOKENS = new BigNumber(web3.toWei(3, 'ether')).toFixed();

      await asserts.throws(crowdsale.manualTransfer(ACC_1, TOKENS, {
        from: ACC_1
      }));
    });

    it('should not transfer more than manual transfer limit', async () => {
      let manualTransferLimit = new BigNumber(await crowdsale.manualTokensTransferReserved.call()).toFixed();
      let half = new BigNumber(manualTransferLimit / 2).toFixed();

      // 1 - transfer half to ACC_1
      await asserts.doesNotThrow(crowdsale.manualTransfer(ACC_1, half), 'manual transfer should success bacause less than limit');
      let manuallyTransferred = new BigNumber(await crowdsale.manualTokensTransferred.call()).toFixed();
      await assert.equal(manuallyTransferred, half, 'manually transferred amount should be equal to half');
      let ACC_1_balance = new BigNumber(await token.balanceOf.call(ACC_1)).toFixed();
      await assert.equal(half, ACC_1_balance, 'manually transfer amount for ACC_1 should be equal to half');

      //  2 - transfer half to ACC_1
      await asserts.doesNotThrow(crowdsale.manualTransfer(ACC_2, half), 'manual transfer should success bacause equals to limit');
      manuallyTransferred = new BigNumber(await crowdsale.manualTokensTransferred.call()).toFixed();
      await assert.equal(manuallyTransferred, manualTransferLimit, 'manually transferred amount should be equal to manualTransferLimit');
      let ACC_2_balance = new BigNumber(await token.balanceOf.call(ACC_2)).toFixed();
      await assert.equal(half, ACC_2_balance, 'manually transferred amount for ACC_2 should be equal to half');

      //  3 - fails because limit is being reached
      await asserts.throws(crowdsale.manualTransfer(ACC_1, half), 'manual transfer should fail bacause would be more than limit');
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

    it.only('validate amount of tokens substracted from crowdsale balance', async () => {
      let icoAddress = crowdsale.address;
      let crowdsaleBalanceBefore = new BigNumber(await token.balanceOf(icoAddress));

      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      let acc2Tokens = new BigNumber(await token.balanceOf(ACC_2));
      let crowdsaleBalanceAfter = new BigNumber(await token.balanceOf(icoAddress));

      assert.equal(acc2Tokens.toFixed(), new BigNumber(crowdsaleBalanceBefore.minus(crowdsaleBalanceAfter)).toFixed());
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

  describe('bonus update', () => {
    it('validate bonus update', async () => {
      const BONUS_0 = 80;
      const BONUS_1 = 10;
      const BONUS_2 = 5;

      await crowdsale.updateStageBonuses([BONUS_0, BONUS_1, BONUS_2]);

      let bonus0 = (await crowdsale.stageBonus.call(0)).toNumber();
      await assert.equal(BONUS_0, bonus0, 'bonus for stage 0 wrong after update');

      let bonus1 = (await crowdsale.stageBonus.call(1)).toNumber();
      await assert.equal(BONUS_1, bonus1, 'bonus for stage 2 wrong after update');

      let bonus2 = (await crowdsale.stageBonus.call(2)).toNumber();
      await assert.equal(BONUS_2, bonus2, 'bonus for stage 2 wrong after update');
    });

    it('validate correct token amount on purchase', async () => {
      const BONUS_0 = 80;
      const BONUS_1 = 10;
      const BONUS_2 = 5;

      await crowdsale.updateStageBonuses([BONUS_0, BONUS_1, BONUS_2]);

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
      assert.equal(tokens, tokensCorrect, 'wrong token amount bought during first stage after bonus update');
    });
  });

  describe('stage timing update', () => {
    it('should validate start & end times update', async () => {
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
      const SOFT_CAP = 1000;

      let latestTime = LatestTime.latestTime();

      let startTimes = [latestTime + STAGE_LENGTH];
      let endTimes = [startTimes[0] + STAGE_LENGTH];

      let localToken = await GDPToken.new();
      let localCrowdsale = await GDPCrowdsale.new(startTimes, endTimes, BASIC_RATE, BONUSES, [], WALLET, SOFT_CAP, localToken.address);
      await localToken.transferOwnership(localCrowdsale.address);

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

      //  1 - can not forward funds
      await asserts.throws(crowdsale.forwardFundsToWallet(), 'tokens can not be transfered to walled if ICO was unsuccessfull');

      //  2 - can not purchase
      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'should not allow purchase after ICO finished');

      //  3 - check vault
      let vaultAddr = await crowdsale.vault();
      let vault = await RefundVault.at(vaultAddr);
      assert.isTrue(await crowdsale.hasEnded.call(), 'crowdsale should be ended before check');
      assert.isFalse(await crowdsale.goalReached.call(), 'goal should not be reached');

      //  4 - claim refund
      let acc1BalanceBefore = (await web3.eth.getBalance(ACC_1)).toNumber();
      assert.equal(new BigNumber(await vault.deposited.call(ACC_1)).toFixed(), ACC_1_WEI_SENT, 'wrong vault deposit for ACC_1 before refund');

      await crowdsale.claimRefund({
        from: ACC_1
      });
      let acc1BalanceAfter = (await web3.eth.getBalance(ACC_1)).toNumber();
      assert.isAbove(acc1BalanceAfter, acc1BalanceBefore, 'balance after refund must be more, then before');
      assert.equal((await vault.deposited.call(ACC_1)).toNumber(), 0, 'wrong vault deposit for ACC_1 after refund');

      //  5 - claim refund again
      await asserts.throws(crowdsale.claimRefund({
        from: ACC_1
      }), 'refund can not be claimed multiple times');

      //  6 - tokens are burned
      await assert.equal(0, new BigNumber(await token.balanceOf.call(crowdsale.address)).toFixed(), 'tokens should be burned');

    });
  });

  describe('local crowdsales created', () => {
    it('validate goal is being reached', async () => {
      const BASIC_RATE = 1800;
      const BONUSES = [40]; //  in %
      const STAGE_LENGTH = IncreaseTime.duration.days(2);
      const WALLET = accounts[0];
      const SOFT_CAP = 10;

      let latestTime = LatestTime.latestTime();

      let startTimes = [latestTime + 11111111];
      let endTimes = [startTimes[0] + STAGE_LENGTH];

      let localToken = await GDPToken.new();
      let localCrowdsale = await GDPCrowdsale.new(startTimes, endTimes, BASIC_RATE, BONUSES, [ACC_1], WALLET, SOFT_CAP, localToken.address);
      await localToken.transferOwnership(localCrowdsale.address);

      await IncreaseTime.increaseTimeTo(startTimes[0] + 1);

      await localCrowdsale.sendTransaction({
        from: ACC_1,
        value: web3.toWei(SOFT_CAP, 'ether')
      });

      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.days(3));

      //  1
      let vaultAddr = await localCrowdsale.vault();
      let vault = await RefundVault.at(vaultAddr);
      assert.isTrue(await localCrowdsale.hasEnded.call(), 'localCrowdsale should be ended before check');
      assert.isTrue(await localCrowdsale.goalReached.call(), 'goal should not be reached');

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

    it('validate user can\'t purchace more, than limit', async () => {
      //  TODO: move to separate file: here and migration file
      const BASIC_RATE = 10000000;
      const BONUSES = [0]; //  in %
      const STAGE_LENGTH = IncreaseTime.duration.days(2);
      const WALLET = accounts[0];
      const SOFT_CAP = 10;

      let latestTime = LatestTime.latestTime() + 111111111;

      let startTimes = [latestTime + STAGE_LENGTH];
      let endTimes = [startTimes[0] + STAGE_LENGTH];

      let localToken = await GDPToken.new();
      let localCrowdsale = await GDPCrowdsale.new(startTimes, endTimes, BASIC_RATE, BONUSES, [], WALLET, SOFT_CAP, localToken.address);
      await localToken.transferOwnership(localCrowdsale.address);

      let purchaseLimit = new BigNumber(await localCrowdsale.icoTokensReserved.call()).toFixed();
      let limitHalf = new BigNumber(purchaseLimit / 2).toFixed();
      let halfPrice = limitHalf / BASIC_RATE;

      await IncreaseTime.increaseTimeTo(startTimes[0] + 1);

      await localCrowdsale.sendTransaction({
        value: halfPrice
      });

      await localCrowdsale.sendTransaction({
        value: halfPrice
      });

      await asserts.throws(localCrowdsale.sendTransaction({
        value: 1
      }), 'should throw, because purchase limit is been already reached');
    });
  });
});
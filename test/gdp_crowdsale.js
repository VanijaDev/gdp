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

  describe('should perform initial validation', () => {
    const TOKEN_TOTAL_SUPPLY_LIMIT = 100000000 * 10 ** 18;

    it('should validate rate', async () => {
      assert.equal(new BigNumber(await crowdsale.rate.call()).toFixed(), 1700, 'wrong rate');
    });

    it('should validate ICO stages count', async () => {
      assert.equal(new BigNumber(await crowdsale.stagesCount.call()).toFixed(), 5, 'wrong ICO stages count');
    });

    it('should validate token was created', async () => {
      assert.notEqual(await crowdsale.token.call(), 0, 'token should be already created');
    });

    it('should validate ICO is not paused', async () => {
      assert.isFalse(await crowdsale.isPaused.call(), 'crowdsale should not be paused');
    });

    it('should validate ICO has not closed', async () => {
      assert.isFalse(await crowdsale.hasEnded.call(), 'crowdsale should not be closed');
    });

    it('should validate owner ownes total supply', async () => {
      assert.equal(new BigNumber(await token.balanceOf.call(crowdsale.address)).toFixed(), new BigNumber(await token.totalSupply.call()).toFixed(), 'owner should own total supply');
    });

    it('should validate token amount for crowdsale purchases amount', async () => {
      let icoPercent = await crowdsale.icoTokensReservedPercent.call();
      const reservedValidation = new BigNumber(await token.totalSupply.call() / 100 * icoPercent).toFixed();
      let reserved = new BigNumber(await crowdsale.icoTokensReserved.call()).toFixed();
      assert.equal(reserved, reservedValidation, 'wrong amount of icoTokensReserved');
    });

    it('should validate newly created token\'s owner', async () => {
      assert.equal(await token.owner.call(), crowdsale.address, 'wrong token owner address');
    });

    it('should validate pause state', async () => {
      assert.isFalse(await crowdsale.isPaused.call(), 'should not be paused at th beginning');
    });

    it('should validate token limit value for ico purchase', async () => {
      let totalSupply = new BigNumber(await token.totalSupply.call()).toFixed();
      let purchaseLimitInPercent = new BigNumber(await crowdsale.icoTokensReservedPercent.call()).toFixed();
      let purchaseLimit = new BigNumber(await crowdsale.icoTokensReserved.call()).toFixed();

      assert.equal(new BigNumber(totalSupply / 100 * purchaseLimitInPercent).toFixed(), purchaseLimit, 'wrong purchase token limit');
    });
  });

  describe('should validate pausable functional', () => {
    it('can be set by owner only', async () => {
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

  describe('should validate manual transfer', () => {
    it('should validate owner can transfer manually', async () => {
      const TOKENS = new BigNumber(web3.toWei(3, 'ether')).toFixed();
      let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

      await asserts.doesNotThrow(crowdsale.manualTransfer(ACC_1, TOKENS));
    });

    it('should validate only owner transfer manually', async () => {
      const TOKENS = new BigNumber(web3.toWei(3, 'ether')).toFixed();

      await asserts.throws(crowdsale.manualTransfer(ACC_1, TOKENS, {
        from: ACC_1
      }));
    });

    it('should validate corrent token amount after owner transfered manually', async () => {
      const TOKENS = new BigNumber(web3.toWei(3, 'ether')).toFixed();
      let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

      crowdsale.manualTransfer(ACC_1, TOKENS);

      let balance = new BigNumber(await token.balanceOf(ACC_1));
      assert.equal(balance, TOKENS, 'wrong token amount after manual transfer');

      let crowdsaleTokensAfterTransfer = new BigNumber(await token.balanceOf.call(crowdsale.address));
      assert.equal(balance, new BigNumber(crowdsaleTokens.minus(crowdsaleTokensAfterTransfer)).toFixed(), 'wrong token amount substracted');
    });
  });

  describe('should validate purchase', () => {
    it('should validate weiRaised value', async () => {
      //  ACC_1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let correctWeiRaised = parseInt(ACC_1_WEI_SENT);
      let weiRaisedResult = new BigNumber(await crowdsale.weiRaised.call()).toFixed();
      assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount after ACC_1 purchase');

      //  ACC_1 + ACC_2
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      correctWeiRaised = parseInt(ACC_1_WEI_SENT) + parseInt(ACC_2_WEI_SENT);
      weiRaisedResult = new BigNumber(await crowdsale.weiRaised.call()).toFixed();
      assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount after ACC_2 purchase');
    });

    it('validate token amount bought for eth', async () => {
      //  [40, 30, 20, 10, 5]     [2, 5, 5, 5, 5]

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let rate = new BigNumber(await crowdsale.rate.call()).toFixed();
      let basicAmount = new BigNumber(parseInt(ACC_1_WEI_SENT) * parseInt(rate));

      let bonus = new BigNumber(40);
      let bonusAmount = basicAmount / 100 * bonus;

      let tokensCorrect = new BigNumber(basicAmount).plus(bonusAmount);
      let tokens = new BigNumber(await token.balanceOf.call(ACC_1));
      assert.equal(tokens.toFixed(), tokensCorrect.toFixed(), 'wrong token amount for ACC_1 after first purchase');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      tokensCorrect = new BigNumber(tokensCorrect * parseInt(2));
      tokens = new BigNumber(await token.balanceOf.call(ACC_1));
      assert.equal(tokens.toFixed(), tokensCorrect.toFixed(), 'wrong token amount for ACC_1 after second purchase');

      //  3
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      basicAmount = new BigNumber(parseInt(ACC_2_WEI_SENT) * parseInt(rate));

      bonus = new BigNumber(30);
      bonusAmount = basicAmount / 100 * bonus;

      tokensCorrect = new BigNumber(basicAmount).plus(bonusAmount);
      tokens = new BigNumber(await token.balanceOf.call(ACC_2));
      assert.equal(tokens.toFixed(), tokensCorrect.toFixed(), 'wrong token amount for ACC_2 after first purchase');

      //  4
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: new BigNumber(web3.toWei(5, 'ether')).toFixed()
      });

      let basicAmount_0 = new BigNumber(web3.toWei(3, 'ether') * parseInt(rate));
      let basicAmount_1 = new BigNumber(web3.toWei(2, 'ether') * parseInt(rate));

      let bonusAmount_0 = basicAmount_0.div(100).mul(30);
      let bonusAmount_1 = basicAmount_1.div(100).mul(20);

      tokensCorrect = basicAmount_0.plus(basicAmount_1).plus(bonusAmount_0).plus(bonusAmount_1).plus(tokensCorrect);
      tokens = new BigNumber(await token.balanceOf.call(ACC_2));
      assert.equal(tokens.toFixed(), tokensCorrect.toFixed(), 'wrong token amount for ACC_2 after second purchase');

      //  5
      let acc1PrevBalance = new BigNumber(await token.balanceOf.call(ACC_1));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: new BigNumber(web3.toWei(20, 'ether')).toFixed()
      });

      basicAmount_0 = new BigNumber(web3.toWei(3, 'ether') * parseInt(rate));
      basicAmount_1 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
      let basicAmount_2 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
      let basicAmount_3 = new BigNumber(web3.toWei(7, 'ether') * parseInt(rate));

      bonusAmount_0 = basicAmount_0.div(100).mul(20);
      bonusAmount_1 = basicAmount_1.div(100).mul(10);
      let bonusAmount_2 = basicAmount_2.div(100).mul(5);

      tokensCorrect = basicAmount_0.plus(basicAmount_1).plus(basicAmount_2).plus(basicAmount_3).plus(bonusAmount_0).plus(bonusAmount_1).plus(bonusAmount_2).plus(acc1PrevBalance);
      tokens = new BigNumber(await token.balanceOf.call(ACC_1));
      assert.equal(tokens.toFixed(), tokensCorrect.toFixed(), 'wrong token amount for ACC_1 after third purchase');
    });

    it('should validate token purchase with 1 wei', async () => {
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: 1
      });

      let rate = new BigNumber(await crowdsale.rate.call()).toFixed();
      let basicAmount = new BigNumber(parseInt(1) * parseInt(rate));

      let bonus = new BigNumber(40);
      let bonusAmount = basicAmount / 100 * bonus;

      let tokensCorrect = new BigNumber(basicAmount).plus(bonusAmount);
      let tokens = new BigNumber(await token.balanceOf.call(ACC_1));
      assert.equal(tokens.toFixed(), tokensCorrect.toFixed(), 'wrong token amount for 1 wei');

    });

    it.only('should validate token purchase with amount more than all stage goals', async () => {
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: new BigNumber(web3.toWei(25, 'ether')).toFixed()
      });

      let rate = new BigNumber(await crowdsale.rate.call()).toFixed();
      let basicAmount_0 = new BigNumber(web3.toWei(2, 'ether') * parseInt(rate));
      let basicAmount_1 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
      let basicAmount_2 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
      let basicAmount_3 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
      let basicAmount_4 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
      let basicAmount_5 = new BigNumber(web3.toWei(3, 'ether') * parseInt(rate));

      let bonusAmount_0 = basicAmount_0.div(100).mul(40);
      let bonusAmount_1 = basicAmount_1.div(100).mul(30);
      let bonusAmount_2 = basicAmount_2.div(100).mul(20);
      let bonusAmount_3 = basicAmount_3.div(100).mul(10);
      let bonusAmount_4 = basicAmount_4.div(100).mul(5);

      let tokensCorrect = basicAmount_0.plus(basicAmount_1).plus(basicAmount_2).plus(basicAmount_3).plus(basicAmount_4).plus(basicAmount_5).plus(bonusAmount_0).plus(bonusAmount_1).plus(bonusAmount_2).plus(bonusAmount_3).plus(bonusAmount_4);
      let tokens = new BigNumber(await token.balanceOf.call(ACC_1));
      console.log(tokens.toFixed(), tokensCorrect.toFixed());
      assert.equal(tokens.toFixed(), tokensCorrect.toFixed(), 'wrong token amount if more than all stage goals');
    });

    it('should validate amount of tokens substracted from crowdsale balance', async () => {
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
    // it('validate correct value in deposits for each investor', async () => {
    //   let vaultAddr = await crowdsale.vault.call();
    //   let vault = await RefundVault.at(vaultAddr);

    //   //  1
    //   await crowdsale.sendTransaction({
    //     from: ACC_1,
    //     value: ACC_1_WEI_SENT
    //   });

    //   let vaultDepositAcc1 = new BigNumber(await vault.deposited.call(ACC_1)).toFixed();
    //   assert.equal(vaultDepositAcc1, ACC_1_WEI_SENT, 'wrong ACC_1 deposit in vault after purchase');

    //   //  2
    //   await crowdsale.sendTransaction({
    //     from: ACC_2,
    //     value: ACC_2_WEI_SENT
    //   });

    //   let vaultDepositAcc2 = new BigNumber(await vault.deposited.call(ACC_2)).toFixed();
    //   assert.equal(vaultDepositAcc2, ACC_2_WEI_SENT, 'wrong ACC_2 deposit in vault after purchase');

    //   //  3
    //   await crowdsale.sendTransaction({
    //     from: ACC_1,
    //     value: ACC_1_WEI_SENT
    //   });

    //   let vaultDepositAcc1_2 = new BigNumber(await vault.deposited.call(ACC_1)).toFixed();
    //   assert.equal(vaultDepositAcc1_2, (ACC_1_WEI_SENT * 2), 'wrong ACC_1 deposit in vault after second purchase');

    //   //  4
    //   let vaultDepositAcc4 = new BigNumber(await vault.deposited.call(web3.eth.accounts[3])).toFixed();
    //   assert.equal(vaultDepositAcc4, 0, 'wrong ACC_4 deposit in vault, should be 0');
    // });
  });

  describe('bonus update', () => {
    it('validate bonus update', async () => {
      const BONUS_0 = 80;
      const BONUS_1 = 10;
      const BONUS_2 = 5;

      await crowdsale.updateStagesBonus([BONUS_0, BONUS_1, BONUS_2]);

      let bonus0 = (await crowdsale.stageBonuses.call(0)).toNumber();
      await assert.equal(BONUS_0, bonus0, 'bonus for stage 0 wrong after update');

      let bonus1 = (await crowdsale.stageBonuses.call(1)).toNumber();
      await assert.equal(BONUS_1, bonus1, 'bonus for stage 2 wrong after update');

      let bonus2 = (await crowdsale.stageBonuses.call(2)).toNumber();
      await assert.equal(BONUS_2, bonus2, 'bonus for stage 2 wrong after update');
    });

    it('validate correct token amount on purchase', async () => {
      const BONUS_0 = 80;
      const BONUS_1 = 10;
      const BONUS_2 = 5;

      await crowdsale.updateStagesBonus([BONUS_0, BONUS_1, BONUS_2]);

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let rate = (await crowdsale.rate.call()).toNumber();
      let basicAmount = ACC_1_WEI_SENT * rate;
      let bonus = (await crowdsale.currentStageBonus.call()).toNumber();
      let bonusAmount = basicAmount * bonus / 100;
      let tokensCorrect = basicAmount + bonusAmount;
      let tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount bought during first stage after bonus update');
    });
  });

  describe('stage timing update', () => {
    it('should validate start & end time update', async () => {
      let latestTime = LatestTime.latestTime();
      let openUp = latestTime + IncreaseTime.duration.days(3);
      let closeUp = openUp + IncreaseTime.duration.days(2);

      await crowdsale.updateOpeningTime(openUp);
      await crowdsale.updateClosingTime(closeUp);

      let open = new BigNumber(await crowdsale.openingTime.call()).toFixed();
      assert.equal(open, openUp, 'opening time is wrong after update');

      let close = new BigNumber(await crowdsale.closingTime.call()).toFixed();
      assert.equal(close, closeUp, 'closing time is wrong after update');
    });
  });

  describe('bonuses', () => {
    it('validate current bonus', async () => {
      //  0
      let currentBonus = new BigNumber(await crowdsale.currentStageBonus.call()).toFixed();
      assert.equal(currentBonus, new BigNumber(await crowdsale.stageBonuses.call(0)).toFixed(), 'wrong bonus for 0 stage');

      //  1
      await crowdsale.sendTransaction({
        value: new BigNumber(await crowdsale.stageGoals.call(0)).toFixed()
      });

      currentBonus = new BigNumber(await crowdsale.currentStageBonus.call()).toFixed();
      assert.equal(currentBonus, new BigNumber(await crowdsale.stageBonuses.call(1)).toFixed(), 'wrong bonus for 1 stage');

      //  2
      let diff = new BigNumber(await crowdsale.stageGoals.call(1)).minus(new BigNumber(await crowdsale.stageGoals.call(0)).toFixed());

      await crowdsale.sendTransaction({
        value: diff
      });
      currentBonus = new BigNumber(await crowdsale.currentStageBonus.call()).toFixed();
      assert.equal(currentBonus, new BigNumber(await crowdsale.stageBonuses.call(2)).toFixed(), 'wrong bonus for 2 stage');

      //  above last stage goal
      await crowdsale.sendTransaction({
        value: web3.toWei(20, 'ether')
      });
      currentBonus = new BigNumber(await crowdsale.currentStageBonus.call()).toFixed();
      assert.equal(currentBonus, new BigNumber(await crowdsale.stageBonuses.call(2)).toFixed(), 'wrong bonus for above all stages');
    });
  });

  /**
   * IMPORTANT: this should be last tests
   */
  describe('validate ICO stages', () => {
    it('can\'t buy tokens before ICO starts', async () => {
      let crowdsaleMock = CrowdsaleMock.crowdsaleMock();

      let localToken = await GDPToken.new();
      let localCrowdsale = await GDPCrowdsale.new(crowdsaleMock.start, crowdsaleMock.end, crowdsaleMock.rate, crowdsaleMock.stageGoals, crowdsaleMock.bonuses, crowdsaleMock.wallet, crowdsaleMock.softCap, localToken.address);
      await localToken.transferOwnership(localCrowdsale.address);

      await asserts.throws(localCrowdsale.sendTransaction({
        value: ACC_1_WEI_SENT
      }), 'should not allow to buy before ICO has started');
    });

    // it('IMPORTANT: should be last test - should validate, crowdsale finish', async () => {
    //   await crowdsale.sendTransaction({
    //     from: ACC_1,
    //     value: ACC_1_WEI_SENT
    //   });

    //   await IncreaseTime.increaseTimeWith(IncreaseTime.duration.weeks(10));

    //   //  1 - can not forward funds
    //   await asserts.throws(crowdsale.forwardFundsToWallet(), 'tokens can not be transfered to walled if ICO was unsuccessfull');

    //   //  2 - can not purchase
    //   await asserts.throws(crowdsale.sendTransaction({
    //     from: ACC_1,
    //     value: ACC_1_WEI_SENT
    //   }), 'should not allow purchase after ICO finished');

    //   //  3 - check vault
    //   let vaultAddr = await crowdsale.vault();
    //   let vault = await RefundVault.at(vaultAddr);
    //   assert.isTrue(await crowdsale.hasEnded.call(), 'crowdsale should be ended before check');
    //   assert.isFalse(await crowdsale.goalReached.call(), 'goal should not be reached');

    //   //  4 - claim refund
    //   let acc1BalanceBefore = (await web3.eth.getBalance(ACC_1)).toNumber();
    //   assert.equal(new BigNumber(await vault.deposited.call(ACC_1)).toFixed(), ACC_1_WEI_SENT, 'wrong vault deposit for ACC_1 before refund');

    //   await crowdsale.claimRefund({
    //     from: ACC_1
    //   });
    //   let acc1BalanceAfter = (await web3.eth.getBalance(ACC_1)).toNumber();
    //   assert.isAbove(acc1BalanceAfter, acc1BalanceBefore, 'balance after refund must be more, then before');
    //   assert.equal((await vault.deposited.call(ACC_1)).toNumber(), 0, 'wrong vault deposit for ACC_1 after refund');

    //   //  5 - claim refund again
    //   await asserts.throws(crowdsale.claimRefund({
    //     from: ACC_1
    //   }), 'refund can not be claimed multiple times');

    //   //  6 - tokens are burned
    //   await assert.equal(0, new BigNumber(await token.balanceOf.call(crowdsale.address)).toFixed(), 'tokens should be burned');

    // });
  });

  describe('create local crowdsales for tests', () => {
    // it('validate goal is being reached', async () => {
    //   let crowdsaleMock = CrowdsaleMock.crowdsaleMock();

    //   let localToken = await GDPToken.new();
    //   let localCrowdsale = await GDPCrowdsale.new(crowdsaleMock.start, crowdsaleMock.end, crowdsaleMock.rate, crowdsaleMock.stageGoals, crowdsaleMock.bonuses, crowdsaleMock.wallet, crowdsaleMock.softCap, localToken.address);
    //   await localToken.transferOwnership(localCrowdsale.address);

    //   await IncreaseTime.increaseTimeTo(crowdsaleMock.start + 1);

    //   await localCrowdsale.sendTransaction({
    //     from: ACC_1,
    //     value: web3.toWei(crowdsaleMock.softCap, 'ether')
    //   });

    //   await IncreaseTime.increaseTimeWith(IncreaseTime.duration.days(3));

    //   //  1
    //   let vaultAddr = await localCrowdsale.vault();
    //   let vault = await RefundVault.at(vaultAddr);
    //   assert.isTrue(await localCrowdsale.hasEnded.call(), 'localCrowdsale should be ended before check');
    //   assert.isTrue(await localCrowdsale.goalReached.call(), 'goal should not be reached');

    //   //  2
    //   await asserts.throws(localCrowdsale.claimRefund({
    //     from: ACC_1
    //   }), 'refund can not be claimed if ICO was successfull');

    //   //  3
    //   await asserts.throws(crowdsale.forwardFundsToWallet({
    //     from: ACC_1
    //   }), 'tokens should be transfered to walled by owner only');

    //   //  4
    //   await asserts.throws(crowdsale.forwardFundsToWallet(), 'tokens shoould be transfered to walled if ICO was successfull');
    // });

    it('validate user can\'t purchace more, than limit', async () => {
      let crowdsaleMock = CrowdsaleMock.crowdsaleMock();

      let localToken = await GDPToken.new();
      let localCrowdsale = await GDPCrowdsale.new(crowdsaleMock.start, crowdsaleMock.end, 10000000, [30], [0], crowdsaleMock.wallet, crowdsaleMock.softCap, localToken.address);
      await localToken.transferOwnership(localCrowdsale.address);

      let purchaseLimit = new BigNumber(await localCrowdsale.icoTokensReserved.call());
      let rate = new BigNumber(await localCrowdsale.rate.call());
      let price = new BigNumber(purchaseLimit.div(rate)).toFixed();

      await IncreaseTime.increaseTimeTo(crowdsaleMock.start + 1);

      await localCrowdsale.sendTransaction({
        value: price
      });

      await asserts.throws(localCrowdsale.sendTransaction({
        value: 1
      }), 'should throw, because purchase limit is been already reached');
    });
  });
});
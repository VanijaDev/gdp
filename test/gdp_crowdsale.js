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

contract('GDPCrowdsale before ICO started', (accounts) => {
  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
      return crowdsale.token.call();
    }).then((tokenAddress) => {
      token = GDPToken.at(tokenAddress);
    });
  });

  it('should not purchase before ico starts', async () => {
    await asserts.throws(crowdsale.sendTransaction({
      from: ACC_1,
      value: ACC_1_WEI_SENT
    }), 'purchase can not be performed, before crowdsale is started');
  });
});


contract('PausableCrowdsale', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const ACC_2 = accounts[2];
  const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether'));

  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
      return crowdsale.token.call();
    }).then((tokenAddress) => {
      token = GDPToken.at(tokenAddress);
    }).then(() => {
      IncreaseTime.increaseTimeWith(10);
    }).then(reverter.snapshot);
  });

  afterEach('revert', reverter.revert);

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


contract('TimedCrowdsale', (accounts) => {
  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);
  let crowdsale;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
    }).then(() => {
      IncreaseTime.increaseTimeWith(10);
    }).then(reverter.snapshot);
  });

  afterEach('revert', reverter.revert);

  describe('initial validation', () => {
    it('should validate ICO has not closed', async () => {
      assert.isFalse(await crowdsale.hasEnded.call(), 'crowdsale should not be closed');
    });
  });

  describe('should validate stage timing update', () => {
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
});


contract('RefundableCrowdsale', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const ACC_2 = accounts[2];
  const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether'));

  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
      return crowdsale.token.call();
    }).then((tokenAddress) => {
      token = GDPToken.at(tokenAddress);
    }).then(() => {
      IncreaseTime.increaseTimeWith(10);
    }).then(reverter.snapshot);
  });

  afterEach('revert', reverter.revert);

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


contract('StagesCrowdsale', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const ACC_2 = accounts[2];
  const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether'));

  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
      return crowdsale.token.call();
    }).then((tokenAddress) => {
      token = GDPToken.at(tokenAddress);
    }).then(() => {
      IncreaseTime.increaseTimeWith(10);
    }).then(reverter.snapshot);
  });

  afterEach('revert', reverter.revert);

  describe('should perform initial validation', () => {
    it('should validate hardCap > softCap and both caps > 0', async () => {
      let softCap = new BigNumber(await crowdsale.softCap.call());
      let hardCap = new BigNumber(await crowdsale.hardCap.call());

      await assert.isAbove(softCap.toFixed(), 0, 'softCap must be > 0');
      await assert.isAbove(hardCap.toFixed(), softCap, 'hardCap must be > softCap');
    });

    it('should validate weiRaised == 0', async () => {
      let weiRaised = new BigNumber(await crowdsale.weiRaised.call());
      await assert.equal(weiRaised.toFixed(), 0, 'weiRaised must be 0');
    });

    it('should validate weiRaised == 0', async () => {
      let weiRaised = new BigNumber(await crowdsale.weiRaised.call());
      await assert.equal(weiRaised.toFixed(), 0, 'weiRaised must be 0');
    });

    it('should validate weiRaised == 0', async () => {
      let weiRaised = new BigNumber(await crowdsale.weiRaised.call());
      await assert.equal(weiRaised.toFixed(), 0, 'weiRaised must be 0');
    });

    it('should validate rate > 0', async () => {
      let rate = new BigNumber(await crowdsale.rate.call());
      await assert.isAbove(rate.toFixed(), 0, 'rate must be > 0');
    });

    it('should validate stageGoals count > 0', async () => {
      let stagesCount = new BigNumber(await crowdsale.stagesCount.call());
      await assert.isAbove(stagesCount.toFixed(), 0, 'stagesCount must be > 0');
    });

    it('should validate softCapReached not reached', async () => {
      assert.isFalse(await crowdsale.softCapReached.call());
    });

    it('should validate hardCapReached not reached', async () => {
      assert.isFalse(await crowdsale.hardCapReached.call());
    });

    it('should validate claimRefund not allowed', async () => {
      await asserts.throws(crowdsale.claimRefund({
        from: ACC_1
      }));
    });
  });

  describe('should validate caps reached', () => {
    it('should validate softCapReached was reached', async () => {
      assert.isFalse(await crowdsale.softCapReached.call(), 'soft cap should not be reached yet');

      let softCapValue = new BigNumber(await crowdsale.softCap.call());
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: softCapValue
      });

      assert.isTrue(await crowdsale.softCapReached.call(), 'soft cap should not be alredy reached');
    });

    it('should validate hardCapReached was reached', async () => {
      assert.isFalse(await crowdsale.hardCapReached.call(), 'hard cap should not be reached yet');

      let hardCapValue = new BigNumber(await crowdsale.hardCap.call());
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: hardCapValue
      });

      assert.isTrue(await crowdsale.hardCapReached.call(), 'hard cap should not be alredy reached');
    });
  });

  describe('update stage goals', () => {
    it('should validate updateStageGoals', async () => {
      await crowdsale.updateStageGoals([11, 22, 33]);

      assert.equal((new BigNumber(await crowdsale.stageGoals.call(0))).toFixed(), web3.toWei(11, 'ether'), 'wrong 0 stage goal after update');
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(1))).toFixed(), web3.toWei(22, 'ether'), 'wrong 1 stage goal after update');
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(2))).toFixed(), web3.toWei(33, 'ether'), 'wrong 2 stage goal after update');
      await asserts.throws(crowdsale.stageGoals.call(3), 'there should be no stage idx 4');

      await asserts.throws(crowdsale.updateStageGoals([11, 22, 33], {
        from: ACC_1
      }), 'only owner can updateStageGoals');
    });
  });

  describe('update individual stage goal', () => {
    it('should successfully update individual goal', async () => {
      await asserts.throws(crowdsale.updateStageGoal(0, 12, {
        from: ACC_1
      }), 'only owner can update individual goal');

      await crowdsale.updateStageGoal(0, 12);
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(0))).toFixed(), web3.toWei(12, 'ether'), 'wrong 0 stage goal after individual update');
      await crowdsale.updateStageGoal(2, 82);
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(2))).toFixed(), web3.toWei(82, 'ether'), 'wrong 2 stage goal after individual update');
    });
  });

  describe('current values', () => {
    it('should validate currentStageIndex, currentStageGoal, currentStageBonus, weiToReceiveLimit are correct while ICO is running', async () => {
      // 
      //   let RATE = 1700;
      //   let BONUSES = [40, 30, 20, 10, 5]; //  in %
      //   if (network == 'develop') {
      //   SOFT_CAP = 50;
      //   HARD_CAP = 75;
      //   STAGE_GOALS = [2, 5, 4, 6, 7];
      //   WALLET = accounts[9];
      //   start = web3.eth.getBlock('latest').timestamp + 10;
      //   end = start + IncreaseTime.duration.days(5);
      //  

      let hardCap = new BigNumber(await crowdsale.hardCap.call());
      let weiToReceiveLimitCorrect = hardCap;

      // 0
      let currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toFixed(), 0, 'wrong stage index, should be 0');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toFixed(), web3.toWei(2, 'ether'), 'wrong stage goal, should be 2 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toFixed(), 40, 'wrong stage bonus, should be 40');
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toFixed(), weiToReceiveLimitCorrect, 'wrong stage weiToReceiveLimitCorrect');

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      //  0.0 - should be the same values
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toFixed(), 0, 'wrong stage index, should be 0');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toFixed(), web3.toWei(2, 'ether'), 'wrong stage goal, should be 2 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toFixed(), 40, 'wrong stage bonus, should be 40');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toFixed(), weiToReceiveLimitCorrect.toFixed(), 'wrong stage weiToReceiveLimitCorrect, should be == hardCap');

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      //  1
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toFixed(), 1, 'wrong stage index, should be 1');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toFixed(), web3.toWei(5, 'ether'), 'wrong stage goal, should be 5 ETH');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toFixed(), weiToReceiveLimitCorrect.toFixed(), 'wrong stage weiToReceiveLimitCorrect for 1');

      let ETH_AMOUNT_6 = new BigNumber(web3.toWei(6, 'ether'));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ETH_AMOUNT_6
      });

      //  2
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toFixed(), 2, 'wrong stage index, should be 2');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toFixed(), web3.toWei(4, 'ether'), 'wrong stage goal, should be 4 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toFixed(), 20, 'wrong stage bonus, should be 20');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT).minus(ETH_AMOUNT_6));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toFixed(), weiToReceiveLimitCorrect.toFixed(), 'wrong stage weiToReceiveLimitCorrect for 2');


      let ETH_AMOUNT_5 = new BigNumber(web3.toWei(5, 'ether'));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ETH_AMOUNT_5
      });

      //  3
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toFixed(), 3, 'wrong stage index, should be 3');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toFixed(), web3.toWei(6, 'ether'), 'wrong stage goal, should be 6 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toFixed(), 10, 'wrong stage bonus, should be 10');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT).minus(ETH_AMOUNT_6).minus(ETH_AMOUNT_5));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toFixed(), weiToReceiveLimitCorrect.toFixed(), 'wrong stage weiToReceiveLimitCorrect for 3');

      let ETH_AMOUNT_7 = new BigNumber(web3.toWei(7, 'ether'));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ETH_AMOUNT_7
      });

      //  4
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toFixed(), 4, 'wrong stage index, should be 4');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toFixed(), web3.toWei(7, 'ether'), 'wrong stage goal, should be 7 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toFixed(), 5, 'wrong stage bonus, should be 5');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT).minus(ETH_AMOUNT_6).minus(ETH_AMOUNT_5).minus(ETH_AMOUNT_7));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toFixed(), weiToReceiveLimitCorrect.toFixed(), 'wrong stage weiToReceiveLimitCorrect for 4');

      let ETH_AMOUNT_20 = new BigNumber(web3.toWei(20, 'ether'));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ETH_AMOUNT_20
      });

      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT).minus(ETH_AMOUNT_6).minus(ETH_AMOUNT_5).minus(ETH_AMOUNT_7).minus(ETH_AMOUNT_20));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toFixed(), weiToReceiveLimitCorrect.toFixed(), 'wrong stage weiToReceiveLimitCorrect for after all goals');

    });
  });

});


contract('GDPCrowdsale', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const ACC_2 = accounts[2];
  const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether'));

  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
      return crowdsale.token.call();
    }).then((tokenAddress) => {
      token = GDPToken.at(tokenAddress);
    }).then(() => {
      IncreaseTime.increaseTimeWith(10);
    }).then(reverter.snapshot);
  });

  afterEach('revert', reverter.revert);

  describe('should perform initial validation', () => {
    const TOKEN_TOTAL_SUPPLY_LIMIT = 100000000 * 10 ** 18;

    it('tokens can not be burned, while ICO running', async () => {
      await asserts.throws(crowdsale.burnTokens());
    });

    it('should validate rate', async () => {
      assert.equal(new BigNumber(await crowdsale.rate.call()).toFixed(), 1700, 'wrong rate');
    });

    it('should validate ICO stages count', async () => {
      assert.equal(new BigNumber(await crowdsale.stagesCount.call()).toFixed(), 5, 'wrong ICO stages count');
    });

    it('should validate token was created', async () => {
      assert.notEqual(await crowdsale.token.call(), 0, 'token should be already created');
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

    it('should validate token limit value for ico purchase', async () => {
      let totalSupply = new BigNumber(await token.totalSupply.call()).toFixed();
      let purchaseLimitInPercent = new BigNumber(await crowdsale.icoTokensReservedPercent.call()).toFixed();
      let purchaseLimit = new BigNumber(await crowdsale.icoTokensReserved.call()).toFixed();

      assert.equal(new BigNumber(totalSupply / 100 * purchaseLimitInPercent).toFixed(), purchaseLimit, 'wrong purchase token limit');
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
      const TOKENS = new BigNumber(web3.toWei(3, 'ether'));
      let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

      crowdsale.manualTransfer(ACC_1, TOKENS);

      let balance = new BigNumber(await token.balanceOf(ACC_1));
      assert.equal(balance.toFixed(), TOKENS.toFixed(), 'wrong ACC_1 token amount after manual transfer');

      let crowdsaleTokensAfterTransfer = new BigNumber(await token.balanceOf.call(crowdsale.address));
      assert.equal(balance.toFixed(), new BigNumber(crowdsaleTokens.minus(crowdsaleTokensAfterTransfer)).toFixed(), 'wrong token amount substracted from crowdsale');
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

    it('should validate token purchase with amount more than all stage goals', async () => {
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

    it('should not purchase more, than hardCap', async () => {
      let hardCap = new BigNumber(await crowdsale.hardCap.call());
      let hardCap_2of3 = hardCap.div(3).mul(2);

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: hardCap_2of3
      });

      await asserts.throws(
        crowdsale.sendTransaction({
          from: ACC_2,
          value: hardCap_2of3
        })
      );
    });

    it('should let buy for softCap amount and fail on next 1 wei', async () => {
      let hardCap = new BigNumber(await crowdsale.hardCap.call());

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: hardCap
      });

      await asserts.throws(
        crowdsale.sendTransaction({
          from: ACC_2,
          value: 1
        })
      );
    });
  });

  describe('vault', () => {
    it('validate correct value in deposits for each investor', async () => {
      let vaultAddr = await crowdsale.vault.call();
      let vault = await RefundVault.at(vaultAddr);

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let vaultDepositAcc1 = new BigNumber(await vault.deposited.call(ACC_1));
      assert.equal(vaultDepositAcc1.toFixed(), ACC_1_WEI_SENT.toFixed(), 'wrong ACC_1 deposit in vault after purchase');

      //  2
      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      let vaultDepositAcc2 = new BigNumber(await vault.deposited.call(ACC_2));
      assert.equal(vaultDepositAcc2.toFixed(), ACC_2_WEI_SENT.toFixed(), 'wrong ACC_2 deposit in vault after purchase');

      //  3
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let vaultDepositAcc1_2 = new BigNumber(await vault.deposited.call(ACC_1));
      assert.equal(vaultDepositAcc1_2.toFixed(), (ACC_1_WEI_SENT * 2).toFixed(), 'wrong ACC_1 deposit in vault after second purchase');

      //  4
      let vaultDepositAcc4 = new BigNumber(await vault.deposited.call(web3.eth.accounts[3]));
      assert.equal(vaultDepositAcc4.toFixed(), 0, 'wrong ACC_4 deposit in vault, should be 0');
    });
  });

  describe('bonuses', () => {
    it('validate bonuses update', async () => {
      const BONUS_0 = 80;
      const BONUS_1 = 10;
      const BONUS_2 = 5;

      await crowdsale.updateStageBonuses([BONUS_0, BONUS_1, BONUS_2]);

      let bonus0 = (await crowdsale.stageBonuses.call(0)).toNumber();
      await assert.equal(BONUS_0, bonus0, 'bonus for stage 0 wrong after update');

      let bonus1 = (await crowdsale.stageBonuses.call(1)).toNumber();
      await assert.equal(BONUS_1, bonus1, 'bonus for stage 2 wrong after update');

      let bonus2 = (await crowdsale.stageBonuses.call(2)).toNumber();
      await assert.equal(BONUS_2, bonus2, 'bonus for stage 2 wrong after update');
    });

    it('validate single stage bonus update', async () => {
      const NEW_BONUS = 80;

      await crowdsale.updateStageBonus(0, NEW_BONUS);

      let bonus0 = (await crowdsale.stageBonuses.call(0)).toNumber();
      await assert.equal(NEW_BONUS, bonus0, 'bonus for stage 0 wrong after update single stage bonus update');
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

      let rate = (await crowdsale.rate.call()).toNumber();
      let basicAmount = ACC_1_WEI_SENT * rate;
      let bonus = (await crowdsale.currentStageBonus.call()).toNumber();
      let bonusAmount = basicAmount / 100 * bonus;
      let tokensCorrect = basicAmount + bonusAmount;
      let tokens = (await token.balanceOf.call(ACC_1)).toNumber();
      assert.equal(tokens, tokensCorrect, 'wrong token amount bought during first stage after bonus update');
    });
  });

  describe('events', () => {
    it('should get TokenPurchase event on purchase', async () => {
      let tx = await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let events = tx.logs;
      let purchaseEvent = events[0];

      assert.equal(events.length, 1, 'wrong event count on TokenPurchase');
      assert.equal(purchaseEvent.event, 'TokenPurchase', 'wrong event name');
      assert.equal(purchaseEvent.args.purchaser, ACC_1, 'wrong purchaser');
      assert.equal(purchaseEvent.args.beneficiary, ACC_1, 'wrong beneficiary');
      assert.equal(new BigNumber(purchaseEvent.args.value).toFixed(), ACC_1_WEI_SENT.toFixed(), 'wrong value');
      assert.equal(new BigNumber(purchaseEvent.args.amount).toFixed(), web3.toWei(2380, 'ether'), 'wrong amount');
    });

    it('should get ManualTransfer event on manual transfer', async () => {
      let tx = await crowdsale.manualTransfer(ACC_1, web3.toWei(4760, 'ether'));

      let events = tx.logs;
      let purchaseEvent = events[0];

      assert.equal(events.length, 1, 'wrong event count on ManualTransfer');
      assert.equal(purchaseEvent.event, 'ManualTransfer', 'wrong event name');
      assert.equal(purchaseEvent.args.from, OWNER, 'wrong purchaser');
      assert.equal(purchaseEvent.args.to, ACC_1, 'wrong beneficiary');
      assert.equal(new BigNumber(purchaseEvent.args.amount).toFixed(), web3.toWei(4760, 'ether'), 'wrong amount');
    });

    it('should get CrowdsaleRestored event on restore', async () => {
      let tx = await crowdsale.restoreCrowdsale();

      let events = tx.logs;
      let restoreEvent = events[0];

      assert.equal(events.length, 1, 'wrong event count on CrowdsaleRestored');
      assert.equal(restoreEvent.event, 'CrowdsaleRestored', 'wrong event name');
    });
  });
});


contract('RefundableCrowdsale - new instance', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const ACC_2 = accounts[2];
  const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether'));

  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
      return crowdsale.token.call();
    }).then((tokenAddress) => {
      token = GDPToken.at(tokenAddress);
    }).then(() => {
      IncreaseTime.increaseTimeWith(10);
    }).then(reverter.snapshot);
  });

  afterEach('revert', reverter.revert);

  describe('should perform initial validation', () => {
    it('should validate vault was created', async () => {
      let vaultAddress = await crowdsale.vault.call();
      assert.isTrue(vaultAddress != 0);
    });

    it('should validate claimRefund not allowed', async () => {
      await asserts.throws(crowdsale.claimRefund({
        from: ACC_1
      }));
    });
  });

  describe('refund functional', () => {
    it('should validate refund is NOT AVAILABLE if softcap was reached, but ICO still running by time', async () => {
      let sc = new BigNumber(await crowdsale.softCap.call());

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: sc
      });

      await asserts.throws(crowdsale.claimRefund({
        from: ACC_1
      }));
    });

    it('should validate refund is NOT AVAILABLE if ICO ended by time, but softcap not reached', async () => {
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      await asserts.throws(crowdsale.claimRefund({
        from: ACC_1
      }));
    });

    it('should validate refund is AVAILABLE if softcap not reached and ICO end running by time', async () => {
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });
      let ACC_1_AFTER_PURCHASE = new BigNumber(await web3.eth.getBalance(ACC_1));

      let endTime = new BigNumber(await crowdsale.closingTime.call());
      await IncreaseTime.increaseTimeTo((endTime.plus(10)));

      let vault = await crowdsale.vault.call();
      let wallet = await crowdsale.wallet.call();

      await web3.eth.sendTransaction({
        from: wallet,
        to: vault,
        value: ACC_1_WEI_SENT
      });

      await asserts.doesNotThrow(crowdsale.claimRefund({
        from: ACC_1
      }));

      assert.isAbove((await web3.eth.getBalance(ACC_1)).toFixed(), ACC_1_AFTER_PURCHASE, 'wrong funds after refund');
    });

  });
});


contract('GDPCrowdsale - new instance', (accounts) => {
  const OWNER = accounts[0];

  const ACC_1 = accounts[1];
  const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

  const reverter = new Reverter(web3);
  const asserts = Asserts(assert);
  let crowdsale;
  let token;

  before('setup', () => {
    return GDPCrowdsale.deployed().then((inst) => {
      crowdsale = inst;
      return crowdsale.token.call();
    }).then((tokenAddress) => {
      token = GDPToken.at(tokenAddress);
    }).then(() => {
      IncreaseTime.increaseTimeWith(10);
    }).then(reverter.snapshot);
  });


  afterEach('revert', reverter.revert);

  describe('burn token', () => {
    it('should verify tokens can be burned, when ICO is closed by time', async () => {
      IncreaseTime.increaseTimeWith(IncreaseTime.duration.weeks(1));

      await asserts.throws(crowdsale.burnTokens({
        from: ACC_1
      }), 'not owner can not burn tokens');

      await assert.isAbove(new BigNumber(await token.balanceOf(crowdsale.address)).toFixed(), 0, 'crowdsale should have tokens');

      await asserts.doesNotThrow(crowdsale.burnTokens(), 'owner should be able to burn tokens');
      await assert.equal(new BigNumber(await token.balanceOf(crowdsale.address)).toFixed(), 0, 'crowdsale balance should be 0');

    });
  });

});
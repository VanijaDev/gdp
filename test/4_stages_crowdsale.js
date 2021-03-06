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


contract('StagesCrowdsale', (accounts) => {
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

  describe('should perform initial validation', () => {
    it('should validate hardCap > softCap and both caps > 0', async () => {
      let softCap = new BigNumber(await crowdsale.softCap.call());
      let hardCap = new BigNumber(await crowdsale.hardCap.call());

      await assert.isAbove(softCap.toNumber(), 0, 'softCap must be > 0');
      await assert.isAbove(hardCap.toNumber(), softCap, 'hardCap must be > softCap');
    });

    it('should validate weiRaised == 0', async () => {
      let weiRaised = new BigNumber(await crowdsale.weiRaised.call());
      await assert.equal(weiRaised.toNumber(), 0, 'weiRaised must be 0');
    });

    it('should validate weiRaised == 0', async () => {
      let weiRaised = new BigNumber(await crowdsale.weiRaised.call());
      await assert.equal(weiRaised.toNumber(), 0, 'weiRaised must be 0');
    });

    it('should validate weiRaised == 0', async () => {
      let weiRaised = new BigNumber(await crowdsale.weiRaised.call());
      await assert.equal(weiRaised.toNumber(), 0, 'weiRaised must be 0');
    });

    it('should validate rate > 0', async () => {
      let rate = new BigNumber(await crowdsale.rate.call());
      await assert.isAbove(rate.toNumber(), 0, 'rate must be > 0');
    });

    it('should validate stageGoals count > 0', async () => {
      let stagesCount = new BigNumber(await crowdsale.stagesCount.call());
      await assert.isAbove(stagesCount.toNumber(), 0, 'stagesCount must be > 0');
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
        value: softCapValue.toNumber()
      });

      assert.isTrue(await crowdsale.softCapReached.call(), 'soft cap should not be alredy reached');
    });

    it('should validate hardCapReached was reached', async () => {
      assert.isFalse(await crowdsale.hardCapReached.call(), 'hard cap should not be reached yet');

      let hardCapValue = new BigNumber(await crowdsale.hardCap.call());
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: hardCapValue.toNumber()
      });

      assert.isTrue(await crowdsale.hardCapReached.call(), 'hard cap should not be alredy reached');
    });
  });

  describe('update stage goals', () => {
    it('should updateStageGoals before any purchases', async () => {
      await crowdsale.updateStageGoals([11, 22, 33]);

      assert.equal((new BigNumber(await crowdsale.stageGoals.call(0))).toNumber(), web3.toWei(11, 'ether'), 'wrong 0 stage goal after update');
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(1))).toNumber(), web3.toWei(22, 'ether'), 'wrong 1 stage goal after update');
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(2))).toNumber(), web3.toWei(33, 'ether'), 'wrong 2 stage goal after update');
      await asserts.throws(crowdsale.stageGoals.call(3), 'there should be no stage idx 4');

      await asserts.throws(crowdsale.updateStageGoals([11, 22, 33], {
        from: ACC_1
      }), 'only owner can updateStageGoals');
    });

    it('should updateStageGoals before when on stage index 2', async () => {
      // STAGE_GOALS = [2, 5, 4, 6, 7];
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: web3.toWei(8, 'ether')
      });

      let currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 2, 'wrong stage index, should be 2');

      await crowdsale.updateStageGoals([3, 6, 5]);

      assert.equal((new BigNumber(await crowdsale.stageGoals.call(0))).toNumber(), web3.toWei(3, 'ether'), 'wrong 0 stage goal after update');
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(1))).toNumber(), web3.toWei(6, 'ether'), 'wrong 1 stage goal after update');
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(2))).toNumber(), web3.toWei(5, 'ether'), 'wrong 2 stage goal after update');
      await asserts.throws(crowdsale.stageGoals.call(3), 'there should be no stage idx 4');

      await asserts.throws(crowdsale.updateStageGoals([11, 22, 33], {
        from: ACC_1
      }), 'only owner can updateStageGoals');
    });

    it('should validate correct stage is being selected after purchase -> update stage goals -> purchase', async () => {
      //  STAGE_GOALS = [2, 5, 4, 6, 7];

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: web3.toWei(8, 'ether')
      });

      let currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 2, 'wrong stage index, should be 2');

      await crowdsale.updateStageGoals([3, 6, 5, 6, 7]);

      //  2
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: web3.toWei(9, 'ether')
      });

      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 3, 'wrong stage index, should be 3');
    });

    it('should validate correct stage is being selected after purchase -> update single stage goal -> purchase', async () => {
      //  STAGE_GOALS = [2, 5, 4, 6, 7];

      //  1
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: web3.toWei(8, 'ether')
      });

      let currentIdxResult = await crowdsale.currentStageIndex.call();
      await assert.isTrue(currentIdxResult[0], 'current index should be found');
      await assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 2, 'wrong stage index, should be 2');

      await crowdsale.updateStageGoal(1, 6);

      //  2
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: web3.toWei(5, 'ether')
      });

      currentIdxResult = await crowdsale.currentStageIndex.call();
      await assert.isTrue(currentIdxResult[0], 'current index should be found');
      await assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 3, 'wrong stage index, should be 3');
    });
  });

  describe('update individual stage goal', () => {
    it('should successfully update individual goal', async () => {
      await asserts.throws(crowdsale.updateStageGoal(0, 12, {
        from: ACC_1
      }), 'only owner can update individual goal');

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: web3.toWei(0.2, 'ether')
      });

      await crowdsale.updateStageGoal(0, 12);
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(0))).toNumber(), web3.toWei(12, 'ether'), 'wrong 0 stage goal after individual update');
      await crowdsale.updateStageGoal(2, 82);
      assert.equal((new BigNumber(await crowdsale.stageGoals.call(2))).toNumber(), web3.toWei(82, 'ether'), 'wrong 2 stage goal after individual update');
    });
  });

  describe('validate wei raised', () => {
    it('should validate wei raised in stage', async () => {
      let wei = web3.toWei(0.2, 'ether');

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: wei
      });

      assert.equal(new BigNumber(await crowdsale.raisedInStage.call(0)).toNumber(), wei, 'wrong raised in stage value');
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
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 0, 'wrong stage index, should be 0');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toNumber(), web3.toWei(2, 'ether'), 'wrong stage goal, should be 2 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toNumber(), 40, 'wrong stage bonus, should be 40');
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toNumber(), weiToReceiveLimitCorrect, 'wrong stage weiToReceiveLimitCorrect');

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT.toNumber()
      });

      //  0.0 - should be the same values
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 0, 'wrong stage index, should be 0');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toNumber(), web3.toWei(2, 'ether'), 'wrong stage goal, should be 2 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toNumber(), 40, 'wrong stage bonus, should be 40');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toNumber(), weiToReceiveLimitCorrect.toNumber(), 'wrong stage weiToReceiveLimitCorrect, should be == hardCap');

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT.toNumber()
      });

      //  1
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 1, 'wrong stage index, should be 1');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toNumber(), web3.toWei(5, 'ether'), 'wrong stage goal, should be 5 ETH');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toNumber(), weiToReceiveLimitCorrect.toNumber(), 'wrong stage weiToReceiveLimitCorrect for 1');

      let ETH_AMOUNT_6 = new BigNumber(web3.toWei(6, 'ether'));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ETH_AMOUNT_6.toNumber()
      });

      //  2
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 2, 'wrong stage index, should be 2');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toNumber(), web3.toWei(4, 'ether'), 'wrong stage goal, should be 4 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toNumber(), 20, 'wrong stage bonus, should be 20');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT).minus(ETH_AMOUNT_6));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toNumber(), weiToReceiveLimitCorrect.toNumber(), 'wrong stage weiToReceiveLimitCorrect for 2');


      let ETH_AMOUNT_5 = new BigNumber(web3.toWei(5, 'ether'));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ETH_AMOUNT_5.toNumber()
      });

      //  3
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 3, 'wrong stage index, should be 3');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toNumber(), web3.toWei(6, 'ether'), 'wrong stage goal, should be 6 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toNumber(), 10, 'wrong stage bonus, should be 10');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT).minus(ETH_AMOUNT_6).minus(ETH_AMOUNT_5));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toNumber(), weiToReceiveLimitCorrect.toNumber(), 'wrong stage weiToReceiveLimitCorrect for 3');

      let ETH_AMOUNT_7 = new BigNumber(web3.toWei(7, 'ether'));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ETH_AMOUNT_7.toNumber()
      });

      //  4
      currentIdxResult = await crowdsale.currentStageIndex.call();
      assert.isTrue(currentIdxResult[0], 'current index should be found');
      assert.equal(new BigNumber(currentIdxResult[1]).toNumber(), 4, 'wrong stage index, should be 4');
      assert.equal(new BigNumber(await crowdsale.currentStageGoal.call()).toNumber(), web3.toWei(7, 'ether'), 'wrong stage goal, should be 7 ETH');
      assert.equal(new BigNumber(await crowdsale.currentStageBonus.call()).toNumber(), 5, 'wrong stage bonus, should be 5');
      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT).minus(ETH_AMOUNT_6).minus(ETH_AMOUNT_5).minus(ETH_AMOUNT_7));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toNumber(), weiToReceiveLimitCorrect.toNumber(), 'wrong stage weiToReceiveLimitCorrect for 4');

      let ETH_AMOUNT_20 = new BigNumber(web3.toWei(20, 'ether'));
      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ETH_AMOUNT_20.toNumber()
      });

      weiToReceiveLimitCorrect = new BigNumber(hardCap.minus(ACC_1_WEI_SENT).minus(ACC_1_WEI_SENT).minus(ETH_AMOUNT_6).minus(ETH_AMOUNT_5).minus(ETH_AMOUNT_7).minus(ETH_AMOUNT_20));
      assert.equal(new BigNumber(await crowdsale.weiToReceiveLimit.call()).toNumber(), weiToReceiveLimitCorrect.toNumber(), 'wrong stage weiToReceiveLimitCorrect for after all goals');

    });
  });

});
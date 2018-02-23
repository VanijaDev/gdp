const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');
const Asserts = require('./helpers/asserts');
const Chai = require('chai');

const IncreaseTime = require('./helpers/increaseTime');
const LatestTime = require('./helpers/latestTime');
const Reverter = require('./helpers/reverter');

const STAGE_LENGTH = IncreaseTime.duration.days(2); // 2 days
const WALLET_ADDR = web3.eth.accounts[9];

let startTimes;
let endTimes;

/**
 * Week   0 1 ETH - 3000 - GDP 
 * Week 1&2 1 ETH - 2200 - GDP 
 * Week 3&4 1 ETH - 2000 - GDP
 * Week 5&6 1 ETH - 1800 - GDP
 */
const Rates = [3000, 2200, 2000, 1800];

contract('GDPCrowdsale', (accounts) => {

  let asserts = Asserts(assert);
  let crowdsale;

  // beforeEach('reset', async () => {
  //   startTimes = [];
  //   endTimes = [];

  //   //  construct stages and rates
  //   for (let i = 0; i < Rates.length; i++) {
  //     if (i == 0) {
  //       startTimes.push(LatestTime.latestTime() + 1);
  //       endTimes.push(LatestTime.latestTime() + 1 + STAGE_LENGTH);
  //     } else {
  //       startTimes.push(endTimes[i - 1] + 1);
  //       endTimes.push(startTimes[i] + STAGE_LENGTH);
  //     }
  //   }

  //   crowdsale = await GDPCrowdsale.new(startTimes, endTimes, Rates, WALLET_ADDR);
  // });

  afterEach('revert', () => {
    Reverter.revert;
  });

  describe('initial validation', () => {
    const TOKEN_TOTAL_SUPPLY_LIMIT = 100000000 * 10 ** 18;

    it('validate initial values', async () => {
      assert.equal((await crowdsale.stagesCount.call()).toNumber(), Rates.length, 'wrong ICO stages count');
      assert.notEqual(await crowdsale.token.call(), 0, 'token should be already created');
      assert.isFalse(await crowdsale.hasEnded.call(), 'crowdsale should still go on');
    });

    it('validate newly created token', async () => {
      let token = GDPToken.at(await crowdsale.token.call());
      assert.equal(await token.owner.call(), crowdsale.address, 'wrong token owner address');
      assert.equal(await token.totalSupplyLimit.call(), TOKEN_TOTAL_SUPPLY_LIMIT, 'wrong total supply limit');
    });
  });

  describe('validate token buying operations', () => {
    const ACC_1 = accounts[1];
    const ACC_1_WEI_SENT = web3.toWei(1, 'ether');

    it('can\'t buy tokens before ICO starts', async () => {
      startTimes[0] = LatestTime.latestTime() + IncreaseTime.duration.days(1);
      crowdsale = await GDPCrowdsale.new(startTimes, endTimes, Rates, WALLET_ADDR);

      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'should not allow to buy before ICO has started');
    });

    it('can\'t buy tokens after ICO finishes', async () => {
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.weeks(startTimes.length));

      await asserts.throws(crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      }), 'should not allow to buy after ICO has finished');
    });

    const ACC_2 = accounts[2];
    const ACC_2_WEI_SENT = web3.toWei(2, 'ether');

    it('validate weiRaised value', async () => {
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.minutes(1));

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });
      assert.equal((await crowdsale.weiRaised.call()).toNumber(), ACC_1_WEI_SENT, 'wrong weiRaised amount after ACC_1 purchase');

      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      let correctWeiRaised = parseInt(ACC_1_WEI_SENT) + parseInt(ACC_2_WEI_SENT);
      let weiRaisedResult = (await crowdsale.weiRaised.call()).toNumber();
      assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount after ACC_2 purchase');
    });

    it('validate wallet receives correct ETH amount', async () => {
      let walletFundsBefore = (web3.eth.getBalance(await crowdsale.wallet.call())).toNumber();

      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.minutes(1));

      await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      let walletFundsAfter_Acc1 = (web3.eth.getBalance(await crowdsale.wallet.call())).toNumber();
      let diff = walletFundsAfter_Acc1 - walletFundsBefore;
      assert.equal(ACC_1_WEI_SENT, diff, 'wrong funds in wallet after ACC_1 bought tokens');

      await crowdsale.sendTransaction({
        from: ACC_2,
        value: ACC_2_WEI_SENT
      });

      let walletFundsAfter_Acc2 = (web3.eth.getBalance(await crowdsale.wallet.call())).toNumber();
      diff = walletFundsAfter_Acc2 - walletFundsAfter_Acc1;
      assert.equal(ACC_2_WEI_SENT, diff, 'wrong funds in wallet after ACC_2 bought tokens');
    });


    it('buying tokens for 1 ether at stage 1', async () => {
      await IncreaseTime.increaseTimeWith(IncreaseTime.duration.minutes(1));

      let tx = await crowdsale.sendTransaction({
        from: ACC_1,
        value: ACC_1_WEI_SENT
      });

      // event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);
      assert.equal(tx.logs.length, 1, 'should be single event');
      const Log = tx.logs[0];
      const Log_Args = Log.args;

      assert.equal(Log.event, 'TokenPurchase', 'wrong event, should be TokenPurchase');
      assert.equal(Log_Args.purchaser, ACC_1, 'wrong token purchaser');
      assert.equal(Log_Args.beneficiary, ACC_1, 'wrong token beneficiary');
      assert.equal(Log_Args.value.toNumber(), ACC_1_WEI_SENT, 'wrong value amount, must be ', ACC_1_WEI_SENT);
      assert.equal(Log_Args.amount.toNumber(), web3.toWei(Rates[0], 'ether'), 'wrong token amount');

      let token = GDPToken.at(await crowdsale.token());
      let acc1Balance = (await token.balanceOf(ACC_1)).toNumber();
      const VALID_TOKEN_AMOUNT = Rates[0] * ACC_1_WEI_SENT;
      assert.equal(acc1Balance, VALID_TOKEN_AMOUNT, 'wrong token amount bought');
    });
  });



});
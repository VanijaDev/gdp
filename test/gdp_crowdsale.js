const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');
const Asserts = require('./helpers/asserts');
const Chai = require('chai');


const Stage_length = 86400; // 1 day
const CurrentTime = web3.eth.getBlock('latest').timestamp;

const WalletAddr = web3.eth.accounts[9];
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

  const asserts = Asserts(assert);

  let crowdsale;

  beforeEach('reset', async () => {
    startTimes = [];
    endTimes = [];

    //  construct stages and rates
    for (let i = 0; i < Rates.length; i++) {
      if (i == 0) {
        startTimes.push(CurrentTime + 1);
        endTimes.push(CurrentTime + 1 + Stage_length);
      } else {
        startTimes.push(endTimes[i - 1] + 1);
        endTimes.push(startTimes[i] + Stage_length);
      }
    }

    crowdsale = await GDPCrowdsale.new(startTimes, endTimes, Rates, WalletAddr);
  });

  describe('initial validation', () => {
    const TokenTotalSupplyLimit = 100000000 * 10 ** 18;

    it('validate initial values', async () => {
      assert.equal((await crowdsale.stagesCount.call()).toNumber(), Rates.length, 'wrong ICO stages count');
      assert.notEqual(await crowdsale.token.call(), 0, 'token should be already created');
      assert.isFalse(await crowdsale.hasEnded.call(), 'crowdsale should still go on');
    });

    it('validate newly created token', async () => {
      let token = GDPToken.at(await crowdsale.token.call());
      assert.equal(await token.owner.call(), crowdsale.address, 'wrong token owner address');
      assert.equal(await token.totalSupplyLimit.call(), TokenTotalSupplyLimit, 'wrong total supply limit');
    });
  });



});
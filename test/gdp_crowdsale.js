const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');
const Asserts = require('./helpers/asserts');
const Chai = require('chai');


const Stage_length = 86400; // 1 day
const CurrentTime = web3.eth.getBlock('latest').timestamp;

const WalletAddr = web3.eth.accounts[9];
let startTime = [];
let endTime = [];

/**
 * Week   0 1 ETH - 3000 - GDP 
 * Week 1&2 1 ETH - 2200 - GDP 
 * Week 3&4 1 ETH - 2000 - GDP
 * Week 5&6 1 ETH - 1800 - GDP
 */
const Rate = [3000, 2200, 2000, 1800];

contract('GDPCrowdsale', (accounts) => {

  const asserts = Asserts(assert);

  let crowdsale;

  beforeEach('reset', async () => {

    //  construct stages and rates
    for (let i = 0; i < Rate.length; i++) {
      if (i == 0) {
        startTime.push(CurrentTime + 1);
        endTime.push(CurrentTime + 1 + Stage_length);
      } else {
        startTime.push(endTime[i - 1] + 1);
        endTime.push(startTime[i] + Stage_length);
      }
    }

    crowdsale = await GDPCrowdsale.new(startTime, endTime, Rate, WalletAddr);
  });

  describe('initial validation', () => {
    it('validate initial values', async () => {
      assert.equal((await crowdsale.crowdsaleStagesCount.call()).toNumber(), Rate.length, 'wrong ICO stages count');
      assert.notEqual(await crowdsale.token.call(), 0, 'token should be already created');
    });

    it('validate newly created token', async () => {
      let token = await GDPToken.at(await crowdsale.token.call());
      assert.equal(await token.owner.call(), crowdsale.address, 'wrong token owner address');
    });
  });

});
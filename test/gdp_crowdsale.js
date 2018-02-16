let GDPToken = artifacts.require('./GDPToken.sol');
let GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');
const Asserts = require('./helpers/asserts');


const Stage_length = 86400; // 1 day
const CurrentTime = web3.eth.getBlock('latest').timestamp;

const WalletAddr = web3.eth.accounts[9];
let StartTime = [];
let EndTime = [];

/**
 * Week   0 1 ETH - 3000 - GDP 
 * Week 1&2 1 ETH - 2200 - GDP 
 * Week 3&4 1 ETH - 2000 - GDP
 * Week 5&6 1 ETH - 1800 - GDP
 */
let Rate = [3000, 2200, 2000, 1800];

contract('GDPCrowdsale', (accounts) => {

  const asserts = Asserts(assert);

  let crowdsale;

  beforeEach('reset', async () => {

    //  construct stages and rates
    for (let i = 0; i < 4; i++) {
      if (i == 0) {
        StartTime.push(CurrentTime + 1);
        EndTime.push(CurrentTime + 1 + Stage_length);
      } else {
        StartTime.push(EndTime[i - 1]);
        EndTime.push(StartTime[i - 1] + Stage_length);
      }
    }

    crowdsale = await GDPCrowdsale.new(StartTime, EndTime, Rate, WalletAddr);
  });

  describe('initial validation', () => {
    it('validate initial values', async () => {
      const res = await crowdsale.crowdsaleStagesCount.call();
      console.log(res.toNumber());
      // assert.equal(await crowdsale.startTime.call(0).toNumber(), 1);
    });
  });

});
let GDPToken = artifacts.require("./GDPToken.sol");

contract('GDPToken', (accounts) => {
  it('should validate limit for total supply', async () => {
    const TOTAL_SUPPLY_LIMIT = 100000000; //  use without decimals

    let gdp_token = await GDPToken.new();
    let limit = await gdp_token.totalSupplyLimit.call();
    assert.equal(web3.fromWei(limit.toNumber(), 'ether'), TOTAL_SUPPLY_LIMIT, 'limits are different');
  });
});
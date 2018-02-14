let GDPToken = artifacts.require("./GDPToken.sol");

contract('GDPToken', (accounts) => {
  it('should validate limit for total supply', async () => {
    const TOTAL_SUPPLY_LIMIT = 1000;

    let gdp_token = await GDPToken.new(TOTAL_SUPPLY_LIMIT);
    let limit = await gdp_token.totalSupplyLimit.call();
    assert.equal(limit.toNumber(), TOTAL_SUPPLY_LIMIT, 'limits are different');
  });
});
let GDPToken = artifacts.require("./GDPToken.sol");

contract('GDPToken', (accounts) => {
  it('should validate limit for total supply', async () => {
    const TOTAL_SUPPLY_LIMIT = 100000000 * 10 ** 18;

    let gdp_token = await GDPToken.new();
    let limit = await gdp_token.totalSupplyLimit.call();
    console.log(limit.toNumber());
    console.log(TOTAL_SUPPLY_LIMIT);
    assert.equal(limit.toNumber(), TOTAL_SUPPLY_LIMIT, 'limits are different');
  });
});
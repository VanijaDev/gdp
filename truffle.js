var HDWalletProvider = require("truffle-hdwallet-provider");

/**
 * TODO
 * 1. client needs to create his own phrase
 * 2. keep in separate file
 */

var mnemonic = "actress gain faculty gloom lion eight merge gloom ginger horn inner foil";

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    ropsten: {
      // IMPORTANT: host / port or provider
      // host: "localhost",
      // port: 8545,
      provider: new HDWalletProvider(mnemonic, "https://ropsten.infura.io/5bJFB4nwE3wJJgBHjnk8"),
      network_id: 3,
      gas: 4700000,
      // IMPORTANT: try from:
    }
  }
};
const infura = require('./utils/infuraCreds.js');

var HDWalletProvider = require("truffle-hdwallet-provider");

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
      provider: new HDWalletProvider(infura.mnemonic(), infura.url()),
      network_id: 3,
      gas: 4700000,
      // IMPORTANT: try from:
    }
  }
};
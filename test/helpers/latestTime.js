// Returns the time of the last mined block in seconds
exports.latestTime = function () {
    return web3.eth.getBlock('latest').timestamp;
}

function LatestTime(web3) {
    this.latesTime = () => {
        return new Promise((resolve, reject) => {
            web3.currentProvider.sendAsync({
                jsonrpc: '2.0',
                method: 'get_block',
                id: new Date().getTime(),
                params: ['latest']
            }, (err, result) => {
                if (err) {
                    return reject(err);
                }

                return resolve
            });
        });
    };
}

module.exports = LatestTime;
const GDPToken = artifacts.require('./GDPToken.sol');
const GDPCrowdsale = artifacts.require('./GDPCrowdsale.sol');
const RefundVault = artifacts.require('./utils/RefundVault.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');
const IncreaseTime = require('../test/helpers/increaseTime');
const LatestTime = require('../test/helpers/latestTime');
const CrowdsaleMock = require('../test/helpers/crowdsaleMock');
const Chai = require('chai');
var BigNumber = require('bignumber.js');

contract('GDPCrowdsale before ICO started', (accounts) => {
    const ACC_1 = accounts[1];
    const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

    const asserts = Asserts(assert);
    let crowdsale;
    let token;

    before('setup', async () => {
        crowdsale = await GDPCrowdsale.deployed();
        token = await GDPToken.at(await crowdsale.token.call());
        await Reverter.snapshot();
    });

    afterEach('revert', async () => {
        await Reverter.revert();
    });

    it('should not purchase before ico starts', async () => {
        await asserts.throws(crowdsale.sendTransaction({
            from: ACC_1,
            value: ACC_1_WEI_SENT
        }), 'purchase can not be performed, before crowdsale is started');
    });

    it('should validate start time update', async () => {
        let latestTime = LatestTime.latestTime();
        let openUp = latestTime + IncreaseTime.duration.days(1);

        let closingTime = new BigNumber(await crowdsale.closingTime.call());

        await asserts.throws(crowdsale.updateOpeningTime(closingTime), 'should fails if open time == closingTime');
        await asserts.throws(crowdsale.updateOpeningTime(closingTime.plus(111)), 'should fails if open time > closingTime');

        await crowdsale.updateOpeningTime(openUp);

        let open = new BigNumber(await crowdsale.openingTime.call()).toNumber();
        assert.equal(open, openUp, 'opening time is wrong after update');
    });

    it('should validate is not running', async () => {
        assert.isFalse(await crowdsale.isRunning.call(), 'should not be running before ICO was started');
    });
});


contract('GDPCrowdsale', (accounts) => {
    const OWNER = accounts[0];

    const ACC_1 = accounts[1];
    const ACC_1_WEI_SENT = new BigNumber(web3.toWei(1, 'ether'));

    const ACC_2 = accounts[2];
    const ACC_2_WEI_SENT = new BigNumber(web3.toWei(2, 'ether'));

    const asserts = Asserts(assert);
    let crowdsale;
    let token;

    before('setup', async () => {
        crowdsale = await GDPCrowdsale.deployed();
        token = await GDPToken.at(await crowdsale.token.call());
        await IncreaseTime.increaseTimeWith(IncreaseTime.duration.seconds(12));
        await Reverter.snapshot();
    });

    afterEach('revert', async () => {
        await Reverter.revert();
    });

    describe('should perform initial validation', () => {
        const TOKEN_TOTAL_SUPPLY_LIMIT = 100000000 * 10 ** 18;

        it('tokens can not be burned, while ICO running', async () => {
            await asserts.throws(crowdsale.burnTokens());
        });

        it('should validate rate', async () => {
            assert.equal(new BigNumber(await crowdsale.rate.call()).toNumber(), 1700, 'wrong rate');
        });

        it('should validate ICO stages count', async () => {
            assert.equal(new BigNumber(await crowdsale.stagesCount.call()).toNumber(), 5, 'wrong ICO stages count');
        });

        it('should validate token was created', async () => {
            assert.notEqual(await crowdsale.token.call(), 0, 'token should be already created');
        });

        it('should validate owner ownes total supply', async () => {
            assert.equal(new BigNumber(await token.balanceOf.call(crowdsale.address)).toNumber(), new BigNumber(await token.totalSupply.call()).toNumber(), 'owner should own total supply');
        });

        it('should validate minimum investment value', async () => {
            assert.equal(new BigNumber(await crowdsale.minimumInvestment.call()).toNumber(), web3.toWei(0.1, 'ether'), 'wrong minimum investment value');
        });

        it('should validate token amount for crowdsale purchases amount', async () => {
            let icoPercent = await crowdsale.icoTokensReservedPercent.call();
            const reservedValidation = new BigNumber(await token.totalSupply.call() / 100 * icoPercent).toNumber();
            let reserved = new BigNumber(await crowdsale.icoTokensReserved.call()).toNumber();
            assert.equal(reserved, reservedValidation, 'wrong amount of icoTokensReserved');
        });

        it('should validate newly created token\'s owner', async () => {
            assert.equal(await token.owner.call(), crowdsale.address, 'wrong token owner address');
        });

        it('should validate token limit value for ico purchase', async () => {
            let totalSupply = new BigNumber(await token.totalSupply.call()).toNumber();
            let purchaseLimitInPercent = new BigNumber(await crowdsale.icoTokensReservedPercent.call()).toNumber();
            let purchaseLimit = new BigNumber(await crowdsale.icoTokensReserved.call()).toNumber();

            assert.equal(new BigNumber(totalSupply / 100 * purchaseLimitInPercent).toNumber(), purchaseLimit, 'wrong purchase token limit');
        });

        it('should validate is running', async () => {
            assert.isTrue(await crowdsale.isRunning.call(), 'should be running');
        });

        it('should not let kill until ICO is running', async () => {
            await asserts.throws(crowdsale.killContract(), 'should not let kill while ICO is running');
        });
    });

    describe('should validate manual transfer', () => {
        it('should validate owner can transfer manually reserved 15% of tokens', async () => {
            const TOKENS = 3;
            let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

            await asserts.doesNotThrow(crowdsale.manualTransferPrivateReservedTokens(ACC_1, TOKENS));
        });

        it('should validate owner can not exceed reserved 15% of tokens for transfer manually', async () => {
            const TOKENS = 30000000;
            let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

            await asserts.throws(crowdsale.manualTransferPrivateReservedTokens(ACC_1, TOKENS));
        });

        it('should validate only owner transfer manually', async () => {
            const TOKENS = 3;

            await asserts.throws(crowdsale.manualTransferPrivateReservedTokens(ACC_1, TOKENS, {
                from: ACC_1
            }));
        });

        it('should validate current token amount after owner transfered manually reserved 15% of tokens', async () => {
            const TOKENS = 3;
            let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

            crowdsale.manualTransferPrivateReservedTokens(ACC_1, TOKENS);

            let balance = new BigNumber(await token.balanceOf(ACC_1));
            assert.equal(balance.toNumber(), new BigNumber(web3.toWei(TOKENS, 'ether')).toNumber(), 'wrong ACC_1 token amount after manual transfer');

            let crowdsaleTokensAfterTransfer = new BigNumber(await token.balanceOf.call(crowdsale.address));
            assert.equal(balance.toNumber(), new BigNumber(crowdsaleTokens.minus(crowdsaleTokensAfterTransfer)).toNumber(), 'wrong token amount substracted from crowdsale');
        });

        it('should validate manual transfer tokens reserved for ICO are substracted from tokens reserved for ICO and added to sold while ICO', async () => {
            let reservedBefore = new BigNumber(await crowdsale.icoTokensReserved.call());
            let soldBefore = new BigNumber(await crowdsale.icoTokensSold.call());

            const TOKENS = 3;
            crowdsale.manualTransferICORecerved(ACC_1, TOKENS);

            let reservedAfter = new BigNumber(await crowdsale.icoTokensReserved.call());
            let soldAfter = new BigNumber(await crowdsale.icoTokensSold.call());

            await assert.equal(soldBefore.plus(new BigNumber(web3.toWei(TOKENS, 'ether'))).toNumber(), soldAfter.toNumber(), "wrong amount of tokens after manual transfer in soldAfter");

        });

        it('should validate corrent token amount after owner transfered manually reserved 15% of tokens', async () => {
            const TOKENS = 3;
            let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

            crowdsale.manualTransferICORecerved(ACC_1, TOKENS);

            let balance = new BigNumber(await token.balanceOf(ACC_1));
            assert.equal(balance.toNumber(), new BigNumber(web3.toWei(TOKENS, 'ether')).toNumber(), 'wrong ACC_1 token amount after manual transfer reserved 15% of tokens');

            let crowdsaleTokensAfterTransfer = new BigNumber(await token.balanceOf.call(crowdsale.address));
            assert.equal(balance.toNumber(), new BigNumber(crowdsaleTokens.minus(crowdsaleTokensAfterTransfer)).toNumber(), 'wrong token amount substracted from crowdsale');
        });

        it('should validate owner can not exceed reserved ICO 85% of tokens for transfer manually', async () => {
            const TOKENS = 90000000;
            let crowdsaleTokens = new BigNumber(await token.balanceOf.call(crowdsale.address));

            await asserts.throws(crowdsale.manualTransferICORecerved(ACC_1, TOKENS));
        });
    });

    describe('add bounties functional', () => {
        it('should validate only owner can add boundaries', async () => {
            const TOKENS = 3;
            await asserts.throws(crowdsale.addBounties([ACC_1], [TOKENS], {
                from: ACC_1
            }), 'only owner can add bounty');
        });

        it('should validate input values are correct', async () => {
            const TOKENS = 3;
            await asserts.throws(crowdsale.addBounties([ACC_1], [TOKENS, TOKENS]), 'wrong input params');
        });

        it('should validate owner is able to add single bounty', async () => {
            const TOKENS = 3;
            await asserts.doesNotThrow(crowdsale.addBounties([ACC_1], [TOKENS]), 'owner should be able to add single bounty');
        });

        it('should validate owner is able to add multiple bounties', async () => {
            const TOKENS = 3;
            const TOKENS_1 = 1;
            await asserts.doesNotThrow(crowdsale.addBounties([ACC_1, ACC_2], [TOKENS, TOKENS_1]), 'owner should be able to add multiple bounties');
        });

        it('should validate correct value is being set after adding single bounty', async () => {
            const TOKENS = 3;
            await crowdsale.addBounties([ACC_1], [TOKENS]);

            assert.equal(new BigNumber(await token.balanceOf(ACC_1)).toNumber(), new BigNumber(web3.toWei(TOKENS, 'ether')).toNumber(), 'wrong bounty ACC_1 amount');
        });

        it('should validate correct values are being set after adding multiple bounties', async () => {
            const TOKENS_1 = 3;
            const TOKENS_2 = 1;

            await crowdsale.addBounties([ACC_1, ACC_2], [TOKENS_1, TOKENS_2]);
            assert.equal(new BigNumber(await token.balanceOf(ACC_1)).toNumber(), new BigNumber(web3.toWei(TOKENS_1, 'ether')).toNumber(), 'wrong ACC_1 bounty amount');
            assert.equal(new BigNumber(await token.balanceOf(ACC_2)).toNumber(), new BigNumber(web3.toWei(TOKENS_2, 'ether')).toNumber(), 'wrong ACC_2 bounty amount');
        });

        it('should validate multiple bounties for single address are being combined', async () => {
            const TOKENS_1 = 3;
            const TOKENS_2 = 1;

            await crowdsale.addBounties([ACC_1, ACC_2], [TOKENS_1, TOKENS_2]);
            await crowdsale.addBounties([ACC_1], [TOKENS_2]);
            assert.equal(new BigNumber(await token.balanceOf(ACC_1)).toNumber(), new BigNumber(web3.toWei(TOKENS_1, 'ether')).plus(new BigNumber(web3.toWei(TOKENS_2, 'ether'))).toNumber(), 'wrong ACC_1 bounty amount after multiple adding');
        });

        it('should validate single bounty can not exceed ico reserved tokens', async () => {
            let reserved = new BigNumber(await crowdsale.icoTokensReserved.call());
            let wrongAmount = reserved.plus(new BigNumber(1));

            await asserts.throws(crowdsale.addBounties([ACC_1], [wrongAmount]), 'should fail, because single bounty exceeds ico reserved tokens');
        });

        it('should validate multiple bounties can not exceed ico reserved tokens', async () => {
            let reserved = new BigNumber(await crowdsale.icoTokensReserved.call());
            let wrongAmount = reserved.plus(new BigNumber(2));
            let wrongHalf = wrongAmount.div(new BigNumber(2));

            await asserts.throws(crowdsale.addBounties([ACC_1, ACC_2], [wrongHalf, wrongHalf]), 'should fail, because multiple bounties can not exceed ico reserved tokens');
        });
    });

    describe('should validate purchase', () => {
        it('should validate minimum purchase value', async () => {
            await asserts.throws(crowdsale.sendTransaction({
                from: ACC_1,
                value: web3.toWei(0.001, 'ether')
            }), 'purchase value is less, than minimum value');
            await asserts.doesNotThrow(crowdsale.sendTransaction({
                from: ACC_1,
                value: web3.toWei(0.1, 'ether')
            }), 'purchase value == minimum value, should be purchased');
        });

        it('should validate weiRaised value', async () => {
            //  ACC_1
            await crowdsale.sendTransaction({
                from: ACC_1,
                value: ACC_1_WEI_SENT.toNumber()
            });

            let correctWeiRaised = parseInt(ACC_1_WEI_SENT);
            let weiRaisedResult = new BigNumber(await crowdsale.weiRaised.call()).toNumber();
            assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount after ACC_1 purchase');

            //  ACC_1 + ACC_2
            await crowdsale.sendTransaction({
                from: ACC_2,
                value: ACC_2_WEI_SENT.toNumber()
            });

            correctWeiRaised = parseInt(ACC_1_WEI_SENT) + parseInt(ACC_2_WEI_SENT);
            weiRaisedResult = new BigNumber(await crowdsale.weiRaised.call()).toNumber();
            assert.equal(weiRaisedResult, correctWeiRaised, 'wrong weiRaised amount after ACC_2 purchase');
        });

        it('should validate wallet balance after purchase', async () => {
            let walletAddr = await crowdsale.wallet.call();
            let walletFundsBefore = new BigNumber(await web3.eth.getBalance(walletAddr));
            assert.equal(walletFundsBefore.toNumber(), web3.toWei(100, "ether"), 'wallet balance should be 100 before tx');

            await crowdsale.sendTransaction({
                from: ACC_1,
                value: ACC_1_WEI_SENT.toNumber()
            });

            assert.equal(new BigNumber(await web3.eth.getBalance(walletAddr)).toNumber(), walletFundsBefore.plus(ACC_1_WEI_SENT).toNumber(), 'wallet balance should be walletFundsBefore + ACC_1_WEI_SENT after tx');

        });

        it('validate token amount bought for eth', async () => {
            //  [40, 30, 20, 10, 5]     [2, 5, 5, 5, 5]

            //  1
            await crowdsale.sendTransaction({
                from: ACC_1,
                value: ACC_1_WEI_SENT.toNumber()
            });

            let rate = new BigNumber(await crowdsale.rate.call()).toNumber();
            let basicAmount = new BigNumber(parseInt(ACC_1_WEI_SENT) * parseInt(rate));

            let bonus = new BigNumber(40);
            let bonusAmount = basicAmount / 100 * bonus;

            let tokensCorrect = new BigNumber(basicAmount).plus(bonusAmount);
            let tokens = new BigNumber(await token.balanceOf.call(ACC_1));
            assert.equal(tokens.toNumber(), tokensCorrect.toNumber(), 'wrong token amount for ACC_1 after first purchase');

            //  2
            await crowdsale.sendTransaction({
                from: ACC_1,
                value: ACC_1_WEI_SENT.toNumber()
            });

            tokensCorrect = new BigNumber(tokensCorrect * parseInt(2));
            tokens = new BigNumber(await token.balanceOf.call(ACC_1));
            assert.equal(tokens.toNumber(), tokensCorrect.toNumber(), 'wrong token amount for ACC_1 after second purchase');

            //  3
            await crowdsale.sendTransaction({
                from: ACC_2,
                value: ACC_2_WEI_SENT.toNumber()
            });

            basicAmount = new BigNumber(parseInt(ACC_2_WEI_SENT) * parseInt(rate));

            bonus = new BigNumber(30);
            bonusAmount = basicAmount / 100 * bonus;

            tokensCorrect = new BigNumber(basicAmount).plus(bonusAmount);
            tokens = new BigNumber(await token.balanceOf.call(ACC_2));
            assert.equal(tokens.toNumber(), tokensCorrect.toNumber(), 'wrong token amount for ACC_2 after first purchase');

            4
            await crowdsale.sendTransaction({
                from: ACC_2,
                value: new BigNumber(web3.toWei(5, 'ether')).toNumber()
            });

            let basicAmount_0 = new BigNumber(web3.toWei(3, 'ether') * parseInt(rate));
            let basicAmount_1 = new BigNumber(web3.toWei(2, 'ether') * parseInt(rate));

            let bonusAmount_0 = basicAmount_0.div(100).multipliedBy(30);
            let bonusAmount_1 = basicAmount_1.div(100).multipliedBy(20);

            tokensCorrect = basicAmount_0.plus(basicAmount_1).plus(bonusAmount_0).plus(bonusAmount_1).plus(tokensCorrect);
            tokens = new BigNumber(await token.balanceOf.call(ACC_2));
            assert.equal(tokens.toNumber(), tokensCorrect.toNumber(), 'wrong token amount for ACC_2 after second purchase');

            //  5
            let acc1PrevBalance = new BigNumber(await token.balanceOf.call(ACC_1));
            await crowdsale.sendTransaction({
                from: ACC_1,
                value: new BigNumber(web3.toWei(20, 'ether')).toNumber()
            });

            basicAmount_0 = new BigNumber(web3.toWei(3, 'ether') * parseInt(rate));
            basicAmount_1 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
            let basicAmount_2 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
            let basicAmount_3 = new BigNumber(web3.toWei(7, 'ether') * parseInt(rate));

            bonusAmount_0 = basicAmount_0.div(100).multipliedBy(20);
            bonusAmount_1 = basicAmount_1.div(100).multipliedBy(10);
            let bonusAmount_2 = basicAmount_2.div(100).multipliedBy(5);

            tokensCorrect = basicAmount_0.plus(basicAmount_1).plus(basicAmount_2).plus(basicAmount_3).plus(bonusAmount_0).plus(bonusAmount_1).plus(bonusAmount_2).plus(acc1PrevBalance);
            tokens = new BigNumber(await token.balanceOf.call(ACC_1));
            assert.equal(tokens.toNumber(), tokensCorrect.toNumber(), 'wrong token amount for ACC_1 after third purchase');
        });

        it('should validate token purchase with 0.1 ETH', async () => {
            let purchaseWei = web3.toWei(0.1, 'ether');
            await crowdsale.sendTransaction({
                from: ACC_1,
                value: purchaseWei
            });

            let rate = new BigNumber(await crowdsale.rate.call()).toNumber();
            let basicAmount = new BigNumber(parseInt(purchaseWei) * parseInt(rate));

            let bonus = new BigNumber(40);
            let bonusAmount = basicAmount / 100 * bonus;

            let tokensCorrect = new BigNumber(basicAmount).plus(bonusAmount);
            let tokens = new BigNumber(await token.balanceOf.call(ACC_1));
            assert.equal(tokens.toNumber(), tokensCorrect.toNumber(), 'wrong token amount for 0.1 ETH');

        });

        it('should validate token purchase with amount more than all stage goals', async () => {
            await crowdsale.sendTransaction({
                from: ACC_1,
                value: new BigNumber(web3.toWei(25, 'ether')).toNumber()
            });

            let rate = new BigNumber(await crowdsale.rate.call()).toNumber();
            let basicAmount_0 = new BigNumber(web3.toWei(2, 'ether') * parseInt(rate));
            let basicAmount_1 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
            let basicAmount_2 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
            let basicAmount_3 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
            let basicAmount_4 = new BigNumber(web3.toWei(5, 'ether') * parseInt(rate));
            let basicAmount_5 = new BigNumber(web3.toWei(3, 'ether') * parseInt(rate));

            let bonusAmount_0 = basicAmount_0.div(100).multipliedBy(40);
            let bonusAmount_1 = basicAmount_1.div(100).multipliedBy(30);
            let bonusAmount_2 = basicAmount_2.div(100).multipliedBy(20);
            let bonusAmount_3 = basicAmount_3.div(100).multipliedBy(10);
            let bonusAmount_4 = basicAmount_4.div(100).multipliedBy(5);

            let tokensCorrect = basicAmount_0.plus(basicAmount_1).plus(basicAmount_2).plus(basicAmount_3).plus(basicAmount_4).plus(basicAmount_5).plus(bonusAmount_0).plus(bonusAmount_1).plus(bonusAmount_2).plus(bonusAmount_3).plus(bonusAmount_4);
            let tokens = new BigNumber(await token.balanceOf.call(ACC_1));
            assert.equal(tokens.toNumber(), tokensCorrect.toNumber(), 'wrong token amount if more than all stage goals');
        });

        it('should validate amount of tokens substracted from crowdsale balance', async () => {
            let icoAddress = crowdsale.address;
            let crowdsaleBalanceBefore = new BigNumber(await token.balanceOf(icoAddress));

            await crowdsale.sendTransaction({
                from: ACC_2,
                value: ACC_2_WEI_SENT.toNumber()
            });

            let acc2Tokens = new BigNumber(await token.balanceOf(ACC_2));
            let crowdsaleBalanceAfter = new BigNumber(await token.balanceOf(icoAddress));

            assert.equal(acc2Tokens.toNumber(), new BigNumber(crowdsaleBalanceBefore.minus(crowdsaleBalanceAfter)).toNumber());
        });

        it('should not purchase more, than hardCap', async () => {
            let hardCap = new BigNumber(await crowdsale.hardCap.call());
            let hardCap_2of3 = hardCap.div(3).multipliedBy(2);

            await crowdsale.sendTransaction({
                from: ACC_1,
                value: hardCap_2of3.toNumber()
            });

            await asserts.throws(
                crowdsale.sendTransaction({
                    from: ACC_2,
                    value: hardCap_2of3
                })
            );
        });

        it('should let buy for softCap amount and fail on next 1 wei', async () => {
            let hardCap = new BigNumber(await crowdsale.hardCap.call());

            await crowdsale.sendTransaction({
                from: ACC_1,
                value: hardCap.toNumber()
            });

            await asserts.throws(
                crowdsale.sendTransaction({
                    from: ACC_2,
                    value: 1
                })
            );
        });

        it('should validate purchase is faulted if all tokens were sent manually', async () => {
            await crowdsale.manualTransferICORecerved(ACC_2, 84999900);

            await asserts.throws(crowdsale.sendTransaction({
                from: ACC_1,
                value: web3.toWei(50, 'ether')
            }), 'should throw because not enough tokens to buy');
        });

        //  buy -> manually transfer more than limit


    });

    describe('vault', () => {
        it('validate correct value in deposits for each investor', async () => {
            let vaultAddr = await crowdsale.vault.call();
            let vault = await RefundVault.at(vaultAddr);

            //  1
            await crowdsale.sendTransaction({
                from: ACC_1,
                value: ACC_1_WEI_SENT.toNumber()
            });

            let vaultDepositAcc1 = new BigNumber(await vault.deposited.call(ACC_1));
            assert.equal(vaultDepositAcc1.toNumber(), ACC_1_WEI_SENT.toNumber(), 'wrong ACC_1 deposit in vault after purchase');

            2
            await crowdsale.sendTransaction({
                from: ACC_2,
                value: ACC_2_WEI_SENT.toNumber()
            });

            let vaultDepositAcc2 = new BigNumber(await vault.deposited.call(ACC_2));
            assert.equal(vaultDepositAcc2.toNumber(), ACC_2_WEI_SENT.toNumber(), 'wrong ACC_2 deposit in vault after purchase');

            //  3
            await crowdsale.sendTransaction({
                from: ACC_1,
                value: ACC_1_WEI_SENT.toNumber()
            });

            let vaultDepositAcc1_2 = new BigNumber(await vault.deposited.call(ACC_1));
            assert.equal(vaultDepositAcc1_2.toNumber(), ACC_1_WEI_SENT.toNumber() * 2, 'wrong ACC_1 deposit in vault after second purchase');

            //  4
            let vaultDepositAcc4 = new BigNumber(await vault.deposited.call(web3.eth.accounts[3]));
            assert.equal(vaultDepositAcc4.toNumber(), 0, 'wrong ACC_4 deposit in vault, should be 0');
        });
    });

    describe('bonuses', () => {
        it('validate bonuses update', async () => {
            const BONUS_0 = 80;
            const BONUS_1 = 10;
            const BONUS_2 = 5;

            await crowdsale.updateStageBonuses([BONUS_0, BONUS_1, BONUS_2]);

            let bonus0 = (await crowdsale.stageBonuses.call(0)).toNumber();
            await assert.equal(BONUS_0, bonus0, 'bonus for stage 0 wrong after update');

            let bonus1 = (await crowdsale.stageBonuses.call(1)).toNumber();
            await assert.equal(BONUS_1, bonus1, 'bonus for stage 2 wrong after update');

            let bonus2 = (await crowdsale.stageBonuses.call(2)).toNumber();
            await assert.equal(BONUS_2, bonus2, 'bonus for stage 2 wrong after update');
        });

        it('validate single stage bonus update', async () => {
            const NEW_BONUS = 80;

            await crowdsale.updateStageBonus(0, NEW_BONUS);

            let bonus0 = (await crowdsale.stageBonuses.call(0)).toNumber();
            await assert.equal(NEW_BONUS, bonus0, 'bonus for stage 0 wrong after update single stage bonus update');
        });

        it('validate correct token amount on purchase', async () => {
            const BONUS_0 = 80;
            const BONUS_1 = 10;
            const BONUS_2 = 5;

            await crowdsale.updateStageBonuses([BONUS_0, BONUS_1, BONUS_2]);

            await crowdsale.sendTransaction({
                from: ACC_1,
                value: ACC_1_WEI_SENT.toNumber()
            });

            let rate = (await crowdsale.rate.call()).toNumber();
            let basicAmount = ACC_1_WEI_SENT * rate;
            let bonus = (await crowdsale.currentStageBonus.call()).toNumber();
            let bonusAmount = basicAmount / 100 * bonus;
            let tokensCorrect = basicAmount + bonusAmount;
            let tokens = (await token.balanceOf.call(ACC_1)).toNumber();
            assert.equal(tokens, tokensCorrect, 'wrong token amount bought during first stage after bonus update');
        });
    });

    describe('closing time', () => {
        it('should  not let update to NOT owner', async () => {
            let latestTime = LatestTime.latestTime();
            let openUp = latestTime + IncreaseTime.duration.days(3);
            let closeUp = openUp + IncreaseTime.duration.days(2);

            await asserts.throws(crowdsale.updateClosingTime(closeUp, {
                from: ACC_1
            }), 'only owner can updateClosingTime');
        });

        it('should not let update if hardCap was reached', async () => {
            let hardCap = new BigNumber(await crowdsale.hardCap.call());

            await crowdsale.sendTransaction({
                from: ACC_1,
                value: hardCap.toNumber()
            });

            let latestTime = LatestTime.latestTime();
            let openUp = latestTime + IncreaseTime.duration.days(3);
            let closeUp = openUp + IncreaseTime.duration.days(2);

            await asserts.throws(crowdsale.updateClosingTime(closeUp), 'closingTime can not be updated if hardCap was reached');

        });
    });

    describe('events', () => {
        it('should get TokenPurchase event on purchase', async () => {
            let tx = await crowdsale.sendTransaction({
                from: ACC_1,
                value: ACC_1_WEI_SENT.toNumber()
            });

            let events = tx.logs;
            let purchaseEvent = events[0];

            assert.equal(events.length, 1, 'wrong event count on TokenPurchase');
            assert.equal(purchaseEvent.event, 'TokenPurchase', 'wrong event name on TokenPurchase');
            assert.equal(purchaseEvent.args.purchaser, ACC_1, 'wrong purchaser on TokenPurchase');
            assert.equal(purchaseEvent.args.beneficiary, ACC_1, 'wrong beneficiary on TokenPurchase');
            assert.equal(new BigNumber(purchaseEvent.args.value).toNumber(), ACC_1_WEI_SENT.toNumber(), 'wrong value on TokenPurchase');
            assert.equal(new BigNumber(purchaseEvent.args.amount).toNumber(), web3.toWei(2380, 'ether'), 'wrong amount on TokenPurchase');
        });

        it('should get ManualTransferOfPrivatelyReservedTokens event on manual transfer', async () => {
            const TOKENS = 10;
            let tx = await crowdsale.manualTransferPrivateReservedTokens(ACC_1, TOKENS);

            let events = tx.logs;
            let purchaseEvent = events[0];

            assert.equal(events.length, 1, 'wrong event count on ManualTransfer');
            assert.equal(purchaseEvent.event, 'ManualTransferOfPrivatelyReservedTokens', 'wrong event name');
            assert.equal(purchaseEvent.args.from, OWNER, 'wrong purchaser');
            assert.equal(purchaseEvent.args.to, ACC_1, 'wrong beneficiary');
            assert.equal(new BigNumber(purchaseEvent.args.amount).toNumber(), web3.toWei(TOKENS, 'ether'), 'wrong amount');
        });

        it('should get ManualTransferOfICOReservedTokens event on manual transfer', async () => {
            const TOKENS = 50;
            let tx = await crowdsale.manualTransferICORecerved(ACC_1, TOKENS);

            let events = tx.logs;
            let purchaseEvent = events[0];

            assert.equal(events.length, 1, 'wrong event count on ManualTransfer');
            assert.equal(purchaseEvent.event, 'ManualTransferOfICOReservedTokens', 'wrong event name');
            assert.equal(purchaseEvent.args.from, OWNER, 'wrong purchaser');
            assert.equal(purchaseEvent.args.to, ACC_1, 'wrong beneficiary');
            assert.equal(new BigNumber(purchaseEvent.args.amount).toNumber(), web3.toWei(TOKENS, 'ether'), 'wrong amount');
        });

        it('should get CrowdsaleRestored event on restore', async () => {
            let tx = await crowdsale.restoreCrowdsale();

            let events = tx.logs;
            let restoreEvent = events[0];

            assert.equal(events.length, 1, 'wrong event count on CrowdsaleRestored');
            assert.equal(restoreEvent.event, 'CrowdsaleRestored', 'wrong event name');
        });
    });
});
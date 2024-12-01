import { Keypair } from "@solana/web3.js";

import base58 from "bs58";
import * as os from "os";
import chalk from "chalk";
import winston from "winston";
import { processBatchTransfers } from "./batch-transfer.js";

// Define enhanced styled log prefixes and formats
const symbols = {
    info: chalk.blueBright.bold('ℹ️'),
    success: chalk.greenBright.bold('✅'),
    warning: chalk.yellowBright.bold('⚠️'),
    error: chalk.redBright.bold('❌'),
    buying: chalk.whiteBright.bgGreen('[BUYING]'),
    selling: chalk.whiteBright.bgRed('[SELLING]'),
};

// Configure the logger with more distinct styling
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => {
            const symbol = symbols[info.level] || '';
            return chalk.gray(`[${info.timestamp}]`) + ' ' + symbol + ' ' + chalk.bold(info.level.toUpperCase()) + ': ' + info.message;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'volume-bot.log' })
    ]
});

const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

class VolumeBot {
    constructor() {
        this.config = {
            amount: parseFloat(process.env.AMOUNT),
            tokenAddress: process.env.TOKEN_ADDRESS,
            delay: parseInt(process.env.DELAY),
            sellDelay: parseInt(process.env.SELL_DELAY),
            slippage: parseInt(process.env.SLIPPAGE),
            priorityFee: parseFloat(process.env.PRIORITY_FEE),
            useJito: process.env.JITO === 'true',
            rpcUrl: process.env.RPC_URL,
            threads: parseInt(process.env.THREADS) || os.cpus().length
        };

        // this.keys = this.createWallets(process.env.NUMBER_WALLETS || 50);
        this.SOL_ADDRESS = 'So11111111111111111111111111111111111111112';
        this.activeWallets = new Set();
    }

    createWallets(numberWallets) {
        const keys = [];
        for (let i = 0; i < numberWallets; i++) {
            const keyPair = Keypair.generate();
            keys.push(keyPair.secretKey);
            const humanReadableKey = base58.encode(Buffer.from(keyPair.secretKey));
            logger.info(`
${chalk.bold.bgBlue(' Wallet Created ')}
${chalk.bold('Number:')}       ${chalk.underline(i + 1)}
${chalk.bold('Address:')}      ${chalk.cyan.bold(keyPair.publicKey.toString())}
${chalk.bold('Secret Key:')}   ${chalk.green(humanReadableKey)}
`);
        }
        return keys;
    }

    getAvailableKeypair() {
        let keypair;
        do {
            const privateKey = this.keys[Math.floor(Math.random() * this.keys.length)];
            keypair = Keypair.fromSecretKey(privateKey);
        } while (this.activeWallets.has(keypair.publicKey.toBase58()));

        this.activeWallets.add(keypair.publicKey.toBase58());
        return keypair;
    }

    release(publicKey) {
        this.activeWallets.delete(publicKey);
    }

    async performSwap(solanaTracker, keypair, isBuy) {
        logger.info(`${isBuy ? symbols.buying : symbols.selling} [${chalk.magenta(keypair.publicKey.toBase58())}] Initiating swap`);
        const { amount, tokenAddress, slippage, priorityFee } = this.config;
        const [fromToken, toToken] = isBuy
            ? [this.SOL_ADDRESS, tokenAddress]
            : [tokenAddress, this.SOL_ADDRESS];

        try {
            const swapResponse = await solanaTracker.getSwapInstructions(
                fromToken,
                toToken,
                isBuy ? amount : 'auto',
                slippage,
                keypair.publicKey.toBase58(),
                priorityFee
            );

            const swapOptions = this.buildSwapOptions();
            const txHash = await solanaTracker.performSwap(swapResponse, swapOptions);
            this.logTransaction(txHash, isBuy);
            return txHash;
        } catch (error) {
            logger.error(`Error performing ${isBuy ? 'buy' : 'sell'}: ${error.message}`, { error });
            return false;
        }
    }

    buildSwapOptions() {
        return {
            sendOptions: { skipPreflight: true },
            confirmationRetries: 30,
            confirmationRetryTimeout: 1000,
            lastValidBlockHeightBuffer: 150,
            resendInterval: 1000,
            confirmationCheckInterval: 1000,
            commitment: 'processed',
            jito: this.config.useJito ? { enabled: true, tip: 0.0001 } : undefined,
        };
    }

    async swap(solanaTracker, keypair) {
        const buyHash = await this.performSwap(solanaTracker, keypair, true);
        if (buyHash) {
            await sleep(this.config.sellDelay);
            return await this.performSwap(solanaTracker, keypair, false);
        }
        return false;
    }

    logTransaction(txHash, isBuy) {
        logger.info(`${isBuy ? symbols.success : symbols.error} ${isBuy ? chalk.greenBright('[BOUGHT]') : chalk.redBright('[SOLD]')} [${chalk.yellow(txHash)}]`);
    }

    async run() {
        // while (true) {
        //     const keypair = this.getAvailableKeypair();
        //     const solanaTracker = new SolanaTracker(keypair, this.config.rpcUrl);
        //
        //     await this.swap(solanaTracker, keypair);
        //     this.release(keypair.publicKey.toBase58());
        //     await sleep(this.config.delay);
        // }
    }

    async start() {
        logger.info(`${symbols.info} Starting Volume Bot`);

        // Create the wallets
        this.keys = this.createWallets(process.env.NUMBER_WALLETS || 50);

        // Fund the wallets
        const signerKeyPair = Keypair.fromSecretKey(base58.decode('privateKey'));
        await processBatchTransfers(signerKeyPair,

        const walletPromises = [];
        const availableThreads = Math.min(this.config.threads, this.keys.length);
        logger.info(`${symbols.info} Available threads: ${chalk.magenta(availableThreads)}`);
        for (let i = 0; i < availableThreads; i++) {
            walletPromises.push(this.run());
        }
        await Promise.all(walletPromises);
    }
}

const bot = new VolumeBot();
bot.start().catch(error => logger.error(`${symbols.error} Error in bot execution`, { error }));

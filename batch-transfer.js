// Function to check if the account has sufficient balance for transfers and fees
import {
    clusterApiUrl,
    Connection,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction
} from "@solana/web3.js";
import { logger } from "./index.js";

async function hasSufficientBalance(connection, sender, accounts) {
    const balance = await connection.getBalance(sender.publicKey);
    const totalTransferAmount = accounts.reduce((acc, { amount }) => acc + amount, 0);
    // const transactionFee = await getTransactionFee(connection);
    logger.info(`Balance: ${balance}, totalTransferAmount: ${totalTransferAmount}`);
    return balance >= totalTransferAmount * accounts.length;
}

// Function to get the current transaction fee
async function getTransactionFee(connection) {
    const { feeCalculator } = await connection.getLatestBlockhashAndContext();
    return feeCalculator.lamportsPerSignature;
}

// Function to create a transfer transaction
function createTransferTransaction(to, amount, sender) {
    const recipientPublicKey = new PublicKey(to);
    return new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: sender.publicKey,
            toPubkey: recipientPublicKey,
            lamports: amount
        })
    );
}

// Function to process batch transfers
export async function processBatchTransfers(sender, accounts) {
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

    if (!await hasSufficientBalance(connection, sender, accounts)) {
        console.error('Insufficient funds for transfers and fees.');
        return;
    }

    process.exit(0);

    const results = { success: [], failure: [] };

    for (const { to, amount } of accounts) {
        const transaction = createTransferTransaction(to, amount, sender);

        try {
            const signature = await sendAndConfirmTransaction(connection, transaction, [sender]);
            console.log(`Transfer successful: ${signature}`);
            results.success.push(signature);
        } catch (error) {
            console.error(`Transfer to ${to} failed:`, error);
            results.failure.push({ to, error });
        }
    }

    console.log(`Batch transfer summary: ${results.success.length} successful, ${results.failure.length} failed.`);
}
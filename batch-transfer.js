const solanaWeb3 = require('@solana/web3.js');


// Function to check if the account has sufficient balance for transfers and fees
async function hasSufficientBalance(connection, sender, accounts) {
    const balance = await connection.getBalance(sender.publicKey);
    const totalTransferAmount = accounts.reduce((acc, { amount }) => acc + amount, 0);
    const transactionFee = await getTransactionFee(connection);
    return balance >= totalTransferAmount + transactionFee * accounts.length;
}

// Function to get the current transaction fee
async function getTransactionFee(connection) {
    const { feeCalculator } = await connection.getRecentBlockhash();
    return feeCalculator.lamportsPerSignature;
}

// Function to create a transfer transaction
function createTransferTransaction(to, amount, sender) {
    const recipientPublicKey = new solanaWeb3.PublicKey(to);
    return new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
            fromPubkey: sender.publicKey,
            toPubkey: recipientPublicKey,
            lamports: amount
        })
    );
}

// Function to process batch transfers
export async function processBatchTransfers(sender, accounts, amount) {
    const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');

    if (!await hasSufficientBalance(connection, sender, accounts)) {
        console.error('Insufficient funds for transfers and fees.');
        return;
    }

    const results = { success: [], failure: [] };

    for (const account of accounts) {
        const transaction = createTransferTransaction(to, amount, sender);

        try {
            const signature = await solanaWeb3.sendAndConfirmTransaction(connection, transaction, [sender]);
            console.log(`Transfer successful: ${signature}`);
            results.success.push(signature);
        } catch (error) {
            console.error(`Transfer to ${to} failed:`, error);
            results.failure.push({ to, error });
        }
    }

    console.log(`Batch transfer summary: ${results.success.length} successful, ${results.failure.length} failed.`);
}
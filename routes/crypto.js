const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const router = express.Router();

// URL of your Monero validation service
// e.g., 'http://localhost:3000/validate-payment' or wherever your microservice runs
const VALIDATION_SERVICE_URL = 'http://localhost:6000/validate-payment';


async function checkTransaction(crypto, txHash, senderAddress) {
    const receiverAddress = wallets[crypto];

    try {
        if (crypto === 'BTC') {
            return await checkBitcoinTransaction(txHash, receiverAddress);
        } else if (crypto === 'ETH') {
            return await checkEthereumTransaction(txHash, receiverAddress);
        } else if (crypto === 'LTC') {
            return await checkLitecoinTransaction(txHash, receiverAddress);
        } else if (crypto === 'SOL') {
            return await checkSolanaTransaction(txHash, receiverAddress);
        } else if (crypto === "XRP") {
            return await checkRippleTransaction(txHash, receiverAddress);
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function checkRippleTransaction(txHash, receiverAddress) {
    // Using Ripple Data API
    const response = await fetch(`https://data.ripple.com/v2/transactions/${txHash}`);

    if (!response.ok) {
        throw new Error('Transaction not found or invalid');
    }

    const data = await response.json();

    if (!data.transaction) {
        return { success: false, error: 'Transaction not found' };
    }

    const tx = data.transaction;

    if (tx.Destination !== receiverAddress) {
        return { success: false, error: 'Payment not sent to the correct address' };
    }

    const amount = parseFloat(tx.Amount) / 1e6; // Convert drops to XRP

    return { success: true, amount: amount };
}

async function checkSolanaTransaction(txHash, receiverAddress) {
    // Using Solana Explorer API
    const response = await fetch(`https://api.mainnet-beta.solana.com`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: [txHash, { encoding: "jsonParsed" }]
        })
    });

    if (!response.ok) {
        throw new Error('Transaction not found or invalid');
    }

    const data = await response.json();

    if (!data.result) {
        return { success: false, error: 'Transaction not found' };
    }

    const tx = data.result;

    // Check if any of the postTokenBalances match the receiver address
    const output = tx.transaction.message.accountKeys.find(acc => acc.pubkey === receiverAddress);

    if (!output) {
        return { success: false, error: 'Payment not sent to the correct address' };
    }

    // Sum up the amount sent to the receiver address
    let amount = 0;
    tx.meta.postTokenBalances.forEach(balance => {
        if (balance.owner === receiverAddress) {
            amount += parseInt(balance.uiTokenAmount.amount) / Math.pow(10, balance.uiTokenAmount.decimals);
        }
    });

    return { success: true, amount: amount };
}

async function checkBitcoinTransaction(txHash, receiverAddress) {
    const response = await fetch(`https://blockchain.info/rawtx/${txHash}`);

    if (!response.ok) {
        throw new Error('Transaction not found or invalid');
    }

    const data = await response.json();

    // Find output to our address
    const output = data.out.find(o => o.addr === receiverAddress);

    if (!output) {
        return { success: false, error: 'Payment not sent to the correct address' };
    }

    const amount = output.value / 100000000; // Convert satoshis to BTC

    return { success: true, amount: amount };
}

async function checkEthereumTransaction(txHash, receiverAddress) {
    // Using Etherscan API (free, no key needed for basic queries)
    const response = await fetch(`https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}`);

    if (!response.ok) {
        throw new Error('Transaction not found or invalid');
    }

    const data = await response.json();

    if (!data.result) {
        return { success: false, error: 'Transaction not found' };
    }

    const tx = data.result;

    if (tx.to.toLowerCase() !== receiverAddress.toLowerCase()) {
        return { success: false, error: 'Payment not sent to the correct address' };
    }

    const amount = parseInt(tx.value, 16) / 1e18; // Convert wei to ETH

    return { success: true, amount: amount };
}

async function checkLitecoinTransaction(txHash, receiverAddress) {
    // Using BlockCypher API for Litecoin
    const response = await fetch(`https://api.blockcypher.com/v1/ltc/main/txs/${txHash}`);

    if (!response.ok) {
        throw new Error('Transaction not found or invalid');
    }

    const data = await response.json();

    // Find output to our address
    const output = data.outputs.find(o => o.addresses && o.addresses.includes(receiverAddress));

    if (!output) {
        return { success: false, error: 'Payment not sent to the correct address' };
    }

    const amount = output.value / 100000000; // Convert litoshis to LTC

    return { success: true, amount: amount };
}

async function checkTransaction(crypto, txHash, senderAddress) {
    const receiverAddress = wallets[crypto];

    try {
        if (crypto === 'BTC') {
            return await checkBitcoinTransaction(txHash, receiverAddress);
        } else if (crypto === 'ETH') {
            return await checkEthereumTransaction(txHash, receiverAddress);
        } else if (crypto === 'LTC') {
            return await checkLitecoinTransaction(txHash, receiverAddress);
        } else if (crypto === 'SOL') {
            return await checkSolanaTransaction(txHash, receiverAddress);
        } else if (crypto === "XRP") {
            return await checkRippleTransaction(txHash, receiverAddress);
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// function validateTransaction(requestBody, validationData) {
//     const {
//         walletAddress,
//         transactionId,
//         cryptoAmount
//     } = requestBody;



//     // Convert the requested LTC amount to litoshis
//     const requiredLitoshis = Math.floor(parseFloat(cryptoAmount) * 1e8);

//     // Extract the transaction data from the validationData
//     // The structure: validationData.data.<txid>.transaction and validationData.data.<txid>.outputs
//     const txData = validationData.data && validationData.data[transactionId];
//     if (!txData) {
//         return { valid: false, message: "Transaction not found in API response." };
//     }

//     const { transaction, outputs } = txData;
//     if (!transaction || !outputs) {
//         return { valid: false, message: "Invalid transaction structure." };
//     }

//     // Check if transaction is confirmed (optional)
//     // For Litecoin on Blockchair, a confirmed transaction should have a block_id.
//     // If you want to ensure it has at least one confirmation, you can check if block_id is not null.
//     if (!transaction.block_id) {
//         return { valid: false, message: "Transaction not confirmed yet." };
//     }

//     // Look for an output that matches the user's walletAddress with enough funds
//     const matchingOutput = outputs.find(output =>
//         output.recipient === walletAddress && output.value >= requiredLitoshis
//     );

//     if (!matchingOutput) {
//         return { valid: false, message: "No matching output found with the required amount." };
//     }

//     // If we reach this point, we found a valid output that matches the address and amount
//     return { valid: true, message: "Transaction is valid and meets the required criteria." };
// }

router.post('/purchase-crypto/:username', async (req, res) => {
    try {
        const {
            username,
            userId,
            name,
            email,
            walletAddress,
            transactionId,
            blockExplorerLink,
            currency,
            amount,
            cryptoAmount,
            rate,
            session_id,
            orderLoggingEnabled,
            userAgent,
            ip,

        } = req.body.data;  // <-- Changed from req.body to req.body.data

        let tempUID = uuidv4();
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        console.log('Logging purchase data:', req.body);

        // Check for duplicates
        const [recentPurchases] = await db.query(
            `
            SELECT * FROM purchases
            WHERE username = ?
              AND created_at >= DATE_SUB(NOW(), INTERVAL 3 HOUR)
            `,
            [username]
        );

        if (recentPurchases.length > 0) {
            return res.status(429).json({
                message: 'You have already made a purchase in the last 3 hours. Please wait before making a new purchase.'
            });
        }

        // 2) Check for duplicates in the same day (or same date)
        const [rows] = await db.query(
            `
            SELECT * FROM purchases 
            WHERE username = ? 
              AND amount = ? 
              AND date = ? 
              AND type = ?
            `,
            [username, amount, date, currency]
        );

        console.log("Duplicate Check Result:", rows);

        if (rows.length > 0) {
            // Duplicate found
            return res.status(409).json({ message: 'Duplicate purchase detected' });
        }



        // 3) Start a DB transaction
        await db.query('START TRANSACTION');

        // 3) Verify the transaction on the blockchain


        try {

            const crypto = currency
            const txHash = transactionId;
            const senderAddress = walletAddress;

            if (!crypto || !txHash || !senderAddress) {
                return res.status(400).json({ error: 'Missing required fields for transaction verification' });
            }
            // Verify the transaction using blockchain APIs
            const result = await checkTransaction(crypto, txHash, senderAddress);

            if (result.success) {
                // const [purchases] = await pool.execute(
                //     'INSERT into buyCredits (username, id, name, email, walletAddress, transactionHash, blockExplorerLink, currency, amount, cryptoAmount, rate, date, time, session_id, orderLoggingEnabled, userAgent, ip, credits) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                //     [
                //         username,
                //         Math.random().toString(36).substring(2, 10),
                //         name,
                //         email,
                //         walletAddress,
                //         transactionId,
                //         blockExplorerLink,
                //         currency,
                //         amount,
                //         cryptoAmount,
                //         rate,
                //         Date.now(),
                //         new Date().toISOString(),
                //         session_id,
                //         orderLoggingEnabled,
                //         userAgent,
                //         ip,
                //         amount !== undefined && amount !== null ? Math.floor(amount) : 0
                //     ]
                // );

                // 4) Insert into "purchases" table
                await db.query(

                    `
                    INSERT INTO purchases 
                        (username, userid, amount, cryptoAmount, reference_id, date, sessionID, transactionId, data, type, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        username,
                        req.user.user_id,  // from authenticateToken middleware
                        amount,
                        cryptoAmount,
                        tempUID,          // unique reference code
                        date,
                        session_id,
                        transactionId,
                        JSON.stringify(req.body),
                        currency,
                        "Pending"
                    ]
                );

                // If you need the recipient account, e.g. "SELECT * FROM accounts WHERE user_id = ?"
                // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [userId]);

                const message = `${currency} order: ${amount}`;


                // 5) Insert a record in "transactions" table
                await db.query(
                    `
            INSERT INTO transactions 
                (sender_account_id, recipient_account_id, amount, transaction_type, status, sending_user, receiving_user, message, reference_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                    [
                        0,          // '0' if it's from system or external
                        userId,
                        amount,
                        'purchase',
                        'pending',
                        "System",
                        "You",
                        message,
                        tempUID,
                    ]
                );

                let notificationMsg = `Your order of ${amount} coins via ${cryptoAmount} ${currency} has been logged and will be processed shortly. `

                try {
                    const [result] = await db.query(
                        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
          VALUES (?, ?, ?, ?, ?, ?)`,
                        ["purchase-logged", req.user.user_id, notificationMsg, "0", username, new Date()]
                    );

                    console.log("New notification successfully created:", notificationMsg);
                    // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
                } catch (error) {
                    console.error('Error creating notification:', error);
                    // res.status(500).json({ message: 'Server error' });
                }



                // await CreateNotification(
                //     'credits_purchased',
                //     'Credits Purchase Logged',
                //     `A new purchase has been logged for user ${username}.`,
                //     'purchase',
                //     username || 'anonymous'
                // );

                // res.json(purchases);
            } else {
                // invladid transaction
                return res.status(400).json({ error: 'Transaction verification failed: ' + result.error });
            }
        } catch (error) {
            console.error('Transaction verification error:', error);
            return res.status(400).json({ error: 'Transaction verification failed: ' + error.message });
        }

        // Insert credits into USERDATA records

        // Update user credits
        if (amount !== undefined && amount !== null && amount > 0) {
            await pool.execute(
                'UPDATE accounts SET spendable = spendable + ? WHERE user_id = ?',
                [Math.floor(amount), userId]
            );
        }

        // Commit the transaction
        await db.query('COMMIT');

        return res.json({
            message: 'Crypto-purchase order logged successfully',
            ok: true
        });
    } catch (error) {
        // If there's an error, rollback the transaction
        await db.query('ROLLBACK');
        console.error('Error reloading wallet:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/validate-transaction', authenticateToken, async (req, res) => {
    /**
     * The data structure in req.body is something like:
     * {
     *   username,
     *   userId,
     *   name,
     *   email,
     *   walletAddress,
     *   key,
     *   transactionId,
     *   currency,
     *   amount,
     *   date,
     *   session_id
     * }
     */
    const {
        username,
        userId,
        amount,
        cryptoAmount,
        date,
        key,
        transactionId,
        currency,
        walletAddress,  // fixed naming from "walletAdress"
        email,
        session_id
    } = req.body;

    console.log("Reloading amount: ", amount), " coins";
    console.log("Body: ", req.body);


    // 2) Proceed with DB logic if the transaction is validated
    try {
        // Check for duplicates
        const [recentPurchases] = await db.query(
            `
            SELECT * FROM purchases
            WHERE username = ?
              AND created_at >= DATE_SUB(NOW(), INTERVAL 3 HOUR)
            `,
            [username]
        );

        if (recentPurchases.length > 0) {
            return res.status(429).json({
                message: 'You have already made a purchase in the last 3 hours. Please wait before making a new purchase.'
            });
        }

        // 2) Check for duplicates in the same day (or same date)
        const [rows] = await db.query(
            `
            SELECT * FROM purchases 
            WHERE username = ? 
              AND amount = ? 
              AND date = ? 
              AND type = ?
            `,
            [username, amount, date, currency]
        );

        console.log("Duplicate Check Result:", rows);

        if (rows.length > 0) {
            // Duplicate found
            return res.status(409).json({ message: 'Duplicate purchase detected' });
        }

        // 3) Start a DB transaction
        await db.query('START TRANSACTION');

        let tempUID = uuidv4();

        // 4) Insert into "purchases" table
        await db.query(

            `
            INSERT INTO purchases 
                (username, userid, amount, currencyAmount, reference_id, date, sessionID, transactionId, data, type, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                username,
                req.user.user_id,  // from authenticateToken middleware
                amount,
                cryptoAmount,
                tempUID,          // unique reference code
                date,
                session_id,
                transactionId,
                JSON.stringify(req.body),
                currency,
                "Pending"
            ]
        );

        // If you need the recipient account, e.g. "SELECT * FROM accounts WHERE user_id = ?"
        // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [userId]);

        const message = `${currency} order: ${amount}`;


        // 5) Insert a record in "transactions" table
        await db.query(
            `
            INSERT INTO transactions 
                (sender_account_id, recipient_account_id, amount, transaction_type, status, sending_user, receiving_user, message, reference_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                0,          // '0' if it's from system or external
                userId,
                amount,
                'purchase',
                'pending',
                "System",
                "You",
                message,
                tempUID,
            ]
        );

        let notificationMsg = `Your order of ${amount} coins via ${cryptoAmount} ${currency} has been logged and will be reviewed shortly. `

        try {
            const [result] = await db.query(
                `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
          VALUES (?, ?, ?, ?, ?, ?)`,
                ["purchase-logged", req.user.user_id, notificationMsg, "0", username, new Date()]
            );

            console.log("New notification successfully created:", notificationMsg);
            // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
        } catch (error) {
            console.error('Error creating notification:', error);
            // res.status(500).json({ message: 'Server error' });
        }


        // // Update user's spendable coin balance
        // await db.query(
        //     'UPDATE accounts SET spendable = spendable + ? WHERE user_id = ?',
        //     [amount, req.user.user_id]
        // );

        // Commit the transaction
        await db.query('COMMIT');

        return res.json({
            message: 'Wallet order logged successfully',
            ok: true
        });
    } catch (error) {
        // If there's an error, rollback the transaction
        await db.query('ROLLBACK');
        console.error('Error reloading wallet:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;

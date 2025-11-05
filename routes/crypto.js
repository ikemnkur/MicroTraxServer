const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const router = express.Router();

// URL of your Monero validation service
// e.g., 'http://localhost:3000/validate-payment' or wherever your microservice runs
// const VALIDATION_SERVICE_URL = 'http://localhost:6000/validate-payment';


async function checkTransaction(crypto, txHash, walletAddress, amount) {
    // const receiverAddress = wallets[crypto];

    try {
        if (crypto === 'BTC') {

            const transactions = await mysqlConnection.query(`SELECT * FROM CryptoTransactions_BTC WHERE hash = ?`, [txHash]);
            if (transactions.error) {
                console.error('MySQL query error:', transactions.error);
                return { success: false, error: 'Database error - transaction check failed' };
            }

            if (transactions.length === 0) {
                console.log('Transaction not found in database');
                return { success: false, error: 'Transaction not found' };
            }

            const tx = transactions[0];
            console.log(`Time: ${tx.time}, Direction: ${tx.direction}, Amount: ${tx.amount}, From: ${tx.from}, To: ${tx.to}, Hash: ${tx.hash}`);

            // Check if transaction already exists
            const existingTx = await mysqlConnection.query(`SELECT * FROM CryptoTransactions_BTC WHERE hash = ?`, [txHash]);
            if (existingTx.length > 0) {
                console.log('Transaction already exists in database');
                return { success: false, error: 'Transaction already exists' };
            }

            // const txamount = await checkBitcoinTransaction(txHash, walletAddress);
            console.log("amount in checkTransaction:", amount, "vs. txamount:", transactions.amount);
            return transactions.amount;

        } else if (crypto === 'ETH') {

            const [transactions] = await db.query(
                `SELECT * FROM CryptoTransactions_ETH WHERE hash = ?`,
                [txHash]
            );

            // const txamount = await checkEthereumTransaction(txHash, walletAddress);
            console.log("amount in checkTransaction:", amount, "vs. txamount:", transactions.amount);
            return transactions.amount;

        } else if (crypto === 'LTC') {

            const transactions = await mysqlConnection.query(`SELECT * FROM CryptoTransactions_LTC WHERE hash = ?`, [txHash]);
            if (transactions.error) {
                console.error('MySQL query error:', transactions.error);
                return { success: false, error: 'Database error - transaction check failed' };
            }

            if (transactions.length === 0) {
                console.log('Transaction not found in database');
                return { success: false, error: 'Transaction not found' };
            }

            const tx = transactions[0];
            console.log(`Time: ${tx.time}, Direction: ${tx.direction}, Amount: ${tx.amount}, From: ${tx.from}, To: ${tx.to}, Hash: ${tx.hash}`);

            // Check if transaction already exists
            const existingTx = await mysqlConnection.query(`SELECT * FROM CryptoTransactions_LTC WHERE hash = ?`, [txHash]);
            if (existingTx.length > 0) {
                console.log('Transaction already exists in database');
                return { success: false, error: 'Transaction already exists' };
            }

            // const txamount = await checkBitcoinTransaction(txHash, walletAddress);
            console.log("amount in checkTransaction:", amount, "vs. txamount:", transactions.amount);
            return transactions.amount;

        } else if (crypto === 'SOL') {

            const transactions = await mysqlConnection.query(`SELECT * FROM CryptoTransactions_SOL WHERE hash = ?`, [txHash]);
            if (transactions.error) {
                console.error('MySQL query error:', transactions.error);
                return { success: false, error: 'Database error - transaction check failed' };
            }

            if (transactions.length === 0) {
                console.log('Transaction not found in database');
                return { success: false, error: 'Transaction not found' };
            }

            const tx = transactions[0];
            console.log(`Time: ${tx.time}, Direction: ${tx.direction}, Amount: ${tx.amount}, From: ${tx.from}, To: ${tx.to}, Hash: ${tx.hash}`);

            // Check if transaction already exists
            const existingTx = await mysqlConnection.query(`SELECT * FROM CryptoTransactions_SOL WHERE hash = ?`, [txHash]);
            if (existingTx.length > 0) {
                console.log('Transaction already exists in database');
                return { success: false, error: 'Transaction already exists' };
            }

            // const txamount = await checkBitcoinTransaction(txHash, walletAddress);
            console.log("amount in checkTransaction:", amount, "vs. txamount:", transactions.amount);
            return {amount: transactions.amount, success: true};

        } else if (crypto === "XRP") {

            // const txamount = await checkRippleTransaction(txHash, walletAddress);
            // console.log("amount in checkTransaction:", amount, "vs. txamount:", txamount);
            // return txamount;
            // return { success: false, error: 'Ripple transaction checking not implemented in this demo' };
            return 0;
        }

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// async function checkTransaction(crypto, txHash, senderAddress) {
//     const receiverAddress = wallets[crypto];

//     try {
//         if (crypto === 'BTC') {
//             return await checkBitcoinTransaction(txHash, receiverAddress);
//         } else if (crypto === 'ETH') {
//             return await checkEthereumTransaction(txHash, receiverAddress);
//         } else if (crypto === 'LTC') {
//             return await checkLitecoinTransaction(txHash, receiverAddress);
//         } else if (crypto === 'SOL') {
//             return await checkSolanaTransaction(txHash, receiverAddress);
//         }

//     } catch (error) {
//         return { success: false, error: error.message };
//     }
// }

// async function checkRippleTransaction(txHash, receiverAddress) {
//     // Using Ripple Data API
//     const response = await fetch(`https://data.ripple.com/v2/transactions/${txHash}`);

//     if (!response.ok) {
//         throw new Error('Transaction not found or invalid');
//     }

//     const data = await response.json();

//     if (!data.transaction) {
//         return { success: false, error: 'Transaction not found' };
//     }

//     const tx = data.transaction;

//     if (tx.Destination !== receiverAddress) {
//         return { success: false, error: 'Payment not sent to the correct address' };
//     }

//     const amount = parseFloat(tx.Amount) / 1e6; // Convert drops to XRP

//     return { success: true, amount: amount };
// }

// async function checkSolanaTransaction(txHash, receiverAddress) {
//     // Using Solana Explorer API
//     const response = await fetch(`https://api.mainnet-beta.solana.com`, {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//             jsonrpc: "2.0",
//             id: 1,
//             method: "getTransaction",
//             params: [txHash, { encoding: "jsonParsed" }]
//         })
//     });

//     if (!response.ok) {
//         throw new Error('Transaction not found or invalid');
//     }

//     const data = await response.json();

//     if (!data.result) {
//         return { success: false, error: 'Transaction not found' };
//     }

//     const tx = data.result;

//     // Check if any of the postTokenBalances match the receiver address
//     const output = tx.transaction.message.accountKeys.find(acc => acc.pubkey === receiverAddress);

//     if (!output) {
//         return { success: false, error: 'Payment not sent to the correct address' };
//     }

//     // Sum up the amount sent to the receiver address
//     let amount = 0;
//     tx.meta.postTokenBalances.forEach(balance => {
//         if (balance.owner === receiverAddress) {
//             amount += parseInt(balance.uiTokenAmount.amount) / Math.pow(10, balance.uiTokenAmount.decimals);
//         }
//     });

//     return { success: true, amount: amount };
// }

// async function checkBitcoinTransaction(txHash, receiverAddress) {
//     const response = await fetch(`https://blockchain.info/rawtx/${txHash}`);

//     if (!response.ok) {
//         throw new Error('Transaction not found or invalid');
//     }

//     const data = await response.json();

//     // Find output to our address
//     const output = data.out.find(o => o.addr === receiverAddress);

//     if (!output) {
//         return { success: false, error: 'Payment not sent to the correct address' };
//     }

//     const amount = output.value / 100000000; // Convert satoshis to BTC

//     return { success: true, amount: amount };
// }

// async function checkEthereumTransaction(txHash, receiverAddress) {
//     // Using Etherscan API (free, no key needed for basic queries)
//     const response = await fetch(`https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}`);

//     if (!response.ok) {
//         throw new Error('Transaction not found or invalid');
//     }

//     const data = await response.json();

//     if (!data.result) {
//         return { success: false, error: 'Transaction not found' };
//     }

//     const tx = data.result;

//     if (tx.to.toLowerCase() !== receiverAddress.toLowerCase()) {
//         return { success: false, error: 'Payment not sent to the correct address' };
//     }

//     const amount = parseInt(tx.value, 16) / 1e18; // Convert wei to ETH

//     return { success: true, amount: amount };
// }

// async function checkLitecoinTransaction(txHash, receiverAddress) {
//     // Using BlockCypher API for Litecoin
//     const response = await fetch(`https://api.blockcypher.com/v1/ltc/main/txs/${txHash}`);

//     if (!response.ok) {
//         throw new Error('Transaction not found or invalid');
//     }

//     const data = await response.json();

//     // Find output to our address
//     const output = data.outputs.find(o => o.addresses && o.addresses.includes(receiverAddress));

//     if (!output) {
//         return { success: false, error: 'Payment not sent to the correct address' };
//     }

//     const amount = output.value / 100000000; // Convert litoshis to LTC

//     return { success: true, amount: amount };
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

        // 1. Check for duplicates
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

        // 4) Verify the transaction is on the DB in tables for each currency transation records
        try {

            const crypto = currency
            const txHash = transactionId;
            const senderAddress = walletAddress;

            if (!crypto || !txHash || !senderAddress) {
                return res.status(400).json({ error: 'Missing required fields for transaction verification' });
            }
            // Verify the transaction using blockchain APIs
            const result = await checkTransaction(crypto, txHash, senderAddress, cryptoAmount);

            if (result.success) {
                // 5) Insert into "purchases" table
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
            await db.query(
                'UPDATE accounts SET spendable = spendable + ? WHERE user_id = ?',
                [Math.floor(amount), userId]
            );
            console.log(`Updated spendable credits for user ${username} by ${amount} coins.`);
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

// ##########################################################

// Crypto Payments Update

router.post('/lookup-transaction', async (req, res) => {

    FetchRecentTransactionsCron();

    try {
        const { sendAddress, blockchain, transactionHash } = req.body;
        console.log('Lookup transaction body -request:', { sendAddress, blockchain, transactionHash });

        let tx = [];
        let result = null;

        if (blockchain === "bitcoin" || blockchain === "BTC") {
            [tx] = await db.query(
                `SELECT * FROM CryptoTransactions_BTC WHERE direction = 'IN' AND hash = ?`,
                [transactionHash]
            );
            console.log('Lookup transaction result for bitcoin:', tx.length > 0 ? tx[0] : 'No transaction found');

            if (tx.length === 0) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            result = tx[0];
        }
        else if (blockchain === "ethereum" || blockchain === "ETH") {
            [tx] = await db.query(
                `SELECT * FROM CryptoTransactions_ETH WHERE direction = 'IN' AND hash = ?`,
                [transactionHash]
            );
            console.log('Lookup transaction result for ethereum:', tx.length > 0 ? tx[0] : 'No transaction found');

            if (tx.length === 0) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            result = tx[0];
        }
        else if (blockchain === "litecoin" || blockchain === "LTC") {
            [tx] = await db.query(
                `SELECT * FROM CryptoTransactions_LTC WHERE direction = 'IN' AND hash = ?`,
                [transactionHash]
            );
            console.log('Lookup transaction result for litecoin:', tx.length > 0 ? tx[0] : 'No transaction found');

            if (tx.length === 0) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            result = tx[0];
        }
        else if (blockchain === "solana" || blockchain === "SOL") {
            [tx] = await db.query(
                `SELECT * FROM CryptoTransactions_SOL WHERE direction = 'IN' AND hash = ?`,
                [transactionHash]
            );
            console.log('Lookup transaction result for solana:', tx.length > 0 ? tx[0] : 'No transaction found');

            if (tx.length === 0) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            result = tx[0];
        }
        else {
            return res.status(400).json({ error: 'Unsupported blockchain. Use bitcoin, ethereum, litecoin, or solana' });
        }

        result.found = true;

        res.json(result);

    } catch (error) {
        console.error('Lookup transaction error:', error);
        res.status(500).json({ error: 'Database error - transaction lookup failed' });
    }

});




// --- Configurable backends (Esplora-compatible) ---
const BTC_ESPLORA = process.env.BTC_ESPLORA || 'https://blockstream.info/api';
const LTC_ESPLORA = process.env.LTC_ESPLORA || 'https://litecoinspace.org/api';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

function ts(sec) {
    if (!sec) return '';
    return new Date(sec * 1000).toISOString().replace('T', ' ').replace('Z', ' UTC');
}
function fmt(amount, decimals) {
    const d = BigInt(10) ** BigInt(decimals);
    const n = BigInt(amount);
    const whole = (n / d).toString();
    const frac = (n % d).toString().padStart(decimals, '0');
    return `${whole}.${frac}`.replace(/\.?0+$/, '');
}

// -------- BTC/LTC via Esplora (Blockstream/mempool/litecoinspace) --------
// Docs: /api/address/:addr/txs (newest first, first page) and /txs/chain?last_seen=txid for paging.
// BTC docs (Esplora): blockstream.info explorer API / mempool.space REST. LTC: litecoinspace.org API.
async function fetchEsploraAddressTxs(baseUrl, address, limit = 100) {
    // First page (newest): /address/:addr/txs returns up to ~25 (varies with deployment)
    const rows = [];
    const seen = new Set();
    let url = `${baseUrl}/address/${address}/txs`;

    while (rows.length < limit && url) {
        const { data } = await axios.get(url, { timeout: 20000 });
        if (!Array.isArray(data) || data.length === 0) break;

        for (const tx of data) {
            if (seen.has(tx.txid)) continue;
            seen.add(tx.txid);

            // Compute net sats for this address from vin/vout
            let spent = 0n, recv = 0n;
            for (const vin of tx.vin || []) {
                const addrs = vin.prevout?.scriptpubkey_address ? [vin.prevout.scriptpubkey_address] : (vin.prevout?.address ? [vin.prevout.address] : []);
                if (addrs.some(a => a && a.toLowerCase() === address.toLowerCase())) {
                    spent += BigInt(vin.prevout?.value ?? 0);
                }
            }
            for (const vout of tx.vout || []) {
                const addrs = vout.scriptpubkey_address ? [vout.scriptpubkey_address] : (vout.address ? [vout.address] : []);
                if (addrs.some(a => a && a.toLowerCase() === address.toLowerCase())) {
                    recv += BigInt(vout.value ?? 0);
                }
            }
            const net = recv - spent; // sats
            const direction = net > 0n ? 'IN' : net < 0n ? 'OUT' : '—';

            // crude counterparty guess
            let fromAddr = null, toAddr = null;
            if (direction === 'IN') {
                const otherIn = tx.vin?.find(v => (v.prevout?.scriptpubkey_address || '').toLowerCase() !== address.toLowerCase());
                fromAddr = otherIn?.prevout?.scriptpubkey_address || null;
                toAddr = address;
            } else if (direction === 'OUT') {
                fromAddr = address;
                const otherOut = tx.vout?.find(v => (v.scriptpubkey_address || '').toLowerCase() !== address.toLowerCase());
                toAddr = otherOut?.scriptpubkey_address || null;
            }

            rows.push({
                time: ts(tx.status?.block_time),
                direction,
                amount: fmt((net < 0n ? -net : net).toString(), 8),
                from: fromAddr,
                to: toAddr,
                hash: tx.txid
            });
            if (rows.length >= limit) break;
        }

        if (rows.length >= limit || data.length === 0) break;
        // Next page: /address/:addr/txs/chain/:last_txid  (Esplora supports last_seen)
        const last = data[data.length - 1]?.txid;
        if (!last) break;
        url = `${baseUrl}/address/${address}/txs/chain/${last}`;
    }

    return rows.slice(0, limit);
}

// -------- ETH via Etherscan --------

/**
 * Fetch transactions for an address using Etherscan API V2.
 * @param {string} address        - The wallet address to look up.
 * @param {number} limit          - Max number of transactions to fetch.
 * @param {number} chainId        - Numeric chain ID (e.g., 1 = Ethereum mainnet).
 * @param {string} action         - E.g., "txlist", "getdeposittxs", etc.
 * @param {object} extraParams    - Any extra query params (e.g., from-address filter).
 */
async function fetchEth({
    address,
    limit = 100,
    chainId = 1,
    action = "txlist",
    extraParams = {}
}) {
    const url = `https://api.etherscan.io/v2/api`;
    const params = {
        apikey: ETHERSCAN_API_KEY,
        chainid: chainId,
        module: "account",            // adjust if other module
        action,
        address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: Math.min(100, limit),
        sort: "desc",
        ...extraParams
    };
    console.log("Etherscan Address:", params.address, "Action:", action, "ChainID:", chainId);

    try {
        const { data } = await axios.get(url, { params, timeout: 20000 });

        if (data.status !== "1") {
            // handle “no results” vs error
            if (data.message && data.message.includes("No transactions found")) {
                return [];
            }
            throw new Error(`Etherscan V2 error: ${data.message} - ${JSON.stringify(data.result)}`);
        }

        // Ensure result is array
        if (!Array.isArray(data.result)) {
            throw new Error(`Unexpected result format: ${JSON.stringify(data.result)}`);
        }

        // Map over the results similarly to your previous logic
        const me = address.toLowerCase();
        return data.result.slice(0, limit).map(t => {
            const from = (t.from || "").toLowerCase();
            const to = (t.to || "").toLowerCase();
            const dir = (to === me && from !== me) ? "IN"
                : (from === me && to !== me) ? "OUT"
                    : "—";

            //       // Example Response

            //       {
            //   "status": "1",
            //   "message": "OK",
            //   "result": [
            //     {
            //       "blockNumber": "23666665",
            //       "blockHash": "0xabf940d34137c7104c7b1f1c4f1049433417d4b4c3e360024062f5066ad92a9f",
            //       "timeStamp": "1761542519",
            //       "hash": "0xb838805293426888a8e44c7a42a3775bf7e2b8c5a779bcd59544dc9cc0bdeaae",
            //       "nonce": "1629552",
            //       "transactionIndex": "88",
            //       "from": "0x6081258689a75d253d87ce902a8de3887239fe80",
            //       "to": "0x9a61f30347258a3d03228f363b07692f3cbb7f27",
            //       "value": "1240860000000000",
            //       "gas": "21000",
            //       "gasPrice": "114277592",
            //       "input": "0x",
            //       "methodId": "0x",
            //       "functionName": "",
            //       "contractAddress": "",
            //       "cumulativeGasUsed": "5026825",
            //       "txreceipt_status": "1",
            //       "gasUsed": "21000",
            //       "confirmations": "20522",
            //       "isError": "0"
            //     }
            //   ]
            // }

            console.log("Etherscan V2 tx:", t);

            // Note: Ensure field names match what the V2 endpoint returns
            return {
                time: new Date(Number(t.timeStamp) * 1000).toISOString(),
                direction: dir,
                amount: t.value /* convert from t.value depending on decimals */,
                from: t.from || null,
                to: t.to || null,
                hash: t.hash
            };
        });

    } catch (error) {
        console.error("fetchEtherscanV2 error:", error.message);
        throw error;
    }
}

// -------- SOL via JSON-RPC --------
async function solRpc(method, params) {
    const { data } = await axios.post(SOLANA_RPC_URL, { jsonrpc: '2.0', id: 1, method, params }, { timeout: 30000 });
    if (data.error) throw new Error(data.error.message || String(data.error));
    return data.result;
}

async function fetchSol(address, limit = 100) {
    const sigs = await solRpc('getSignaturesForAddress', [address, { limit: Math.min(100, limit) }]) || [];
    const out = [];
    for (const s of sigs) {
        const sig = s.signature;
        const tx = await solRpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
        if (!tx) continue;

        const meta = tx.meta || {};
        const msg = tx.transaction?.message || {};
        const keys = (msg.accountKeys || []).map(k => (typeof k === 'string' ? k : k.pubkey));
        const idx = keys.findIndex(k => (k || '').toLowerCase() === address.toLowerCase());
        let net = 0n;
        if (idx >= 0) {
            const pre = BigInt(meta.preBalances?.[idx] ?? 0);
            const post = BigInt(meta.postBalances?.[idx] ?? 0);
            net = post - pre; // lamports, + is IN
        }
        const direction = net > 0n ? 'IN' : net < 0n ? 'OUT' : '—';
        // simple counterparty
        const cp = keys.find(k => (k || '').toLowerCase() !== address.toLowerCase()) || null;

        out.push({
            time: tx.blockTime ? ts(tx.blockTime) : '',
            direction,
            amount: fmt((net < 0n ? -net : net).toString(), 9),
            from: direction === 'IN' ? cp : (direction === 'OUT' ? address : null),
            to: direction === 'IN' ? address : (direction === 'OUT' ? cp : null),
            signature: sig
        });
        if (out.length >= limit) break;
    }
    return out;
}


const walletAddressMap = {
    BTC: 'bc1q4j9e7equq4xvlyu7tan4gdmkvze7wc0egvykr6',
    LTC: 'ltc1qgg5aggedmvjx0grd2k5shg6jvkdzt9dtcqa4dh',
    SOL: 'qaSpvAumg2L3LLZA8qznFtbrRKYMP1neTGqpNgtCPaU',
    ETH: '0x9a61f30347258A3D03228F363b07692F3CBb7f27',
};

async function FetchRecentTransactionsCron() {
    try {
        console.log('🔄 Fetching recent transactions for all wallet addresses...');
        // Iterate over walletAddressMap entries (key = chain, value = address) for the cron job
        for (const [chainKey, addr] of Object.entries(walletAddressMap)) {
            // const txs = await fetchRe,centTransactions(address);
            const chain = String(chainKey || '').toUpperCase();
            const address = String(addr || '').trim();
            // Use a fixed reasonable limit for cron runs
            const limit = 100;
            try {

                if (!address || !chain) {
                    console.log('No address or chain provided');
                    continue; // skip this entry
                }
                let rows = [];
                if (chain === 'BTC') rows = await fetchEsploraAddressTxs(BTC_ESPLORA, address, limit);
                else if (chain === 'LTC') rows = await fetchEsploraAddressTxs(LTC_ESPLORA, address, limit);
                else if (chain === 'ETH') rows = await fetchEth({ address, limit, chainId: 1, action: "txlist", extraParams: {} });
                else if (chain === 'SOL') rows = await fetchSol(address, limit);
                else {
                    console.log('Unsupported chain. Use BTC, LTC, ETH, SOL');
                    continue;
                }
                // return res.status(400).json({ error: 'Unsupported chain. Use BTC, LTC, ETH, SOL' });

                // res.json({ chain, address, count: rows.length, txs: rows });

                let txs = {
                    chain,
                    address,
                    count: rows.length,
                    txs: rows
                };
                // console.log(`✅ Fetched ${rows.length} transactions for ${chain} address ${address}`);


                for (const tx of txs.txs) {
                    const transactionId = tx.hash;

                    // console.log(`Time: ${tx.time}, Direction: ${tx.direction}, Amount: ${tx.amount}, From: ${tx.from}, To: ${tx.to}, Hash: ${tx.hash}`);

                    const [existingTxs] = await db.query(
                        `SELECT * FROM CryptoTransactions_${chain} WHERE hash = ?`,
                        [transactionId]
                    );

                    // Check if transaction already exists
                    if (existingTxs.length > 0) {
                        // console.log(`Transaction ${transactionId} already exists in the database. Skipping.`);
                        continue; // Skip to next transaction
                    }

                    // Insert new transaction
                    await db.query(
                        `INSERT INTO CryptoTransactions_${chain} (time, direction, amount, fromAddress, toAddress, hash) VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            tx.time,
                            tx.direction,
                            tx.amount,
                            tx.from,
                            tx.to,
                            tx.hash,
                        ]
                    );

                    // console.log(`Inserted transaction ${transactionId} into CryptoTransactions_${chain}`);
                }


            } catch (e) {
                // res.status(500).json({ error: e.message || String(e) });
                console.error(`❌ Error processing transactions for ${chain} address ${address}:`, e);
                continue;
            }
            // console.log(`📈 Recent transactions for ${address}:`, txs);
        }
    } catch (error) {
        console.error('❌ Error fetching recent transactions:', error);
    }

}

module.exports = router;

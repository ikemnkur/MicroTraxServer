const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const router = express.Router();

// URL of your Monero validation service
// e.g., 'http://localhost:3000/validate-payment' or wherever your microservice runs
const VALIDATION_SERVICE_URL = 'http://localhost:6000/validate-payment';

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

    // 1) Call the Monero validation service
    //    We'll pass relevant data. The microservice typically expects:
    //    tx_hash, user_address, amount_paid, date, etc.
    //    If your microservice uses subaddress indexes or additional fields,
    //    adapt accordingly.

    let url;
    let validationResponse;

    try {

        if (currency = "LTC")
            url = `https://api.blockchair.com/litecoin/dashboards/transaction/${transactionId}`;
        if (currency = "XMR")
            url = `https://xmrchain.net/api/transaction/${transactionId}`;
        if (currency = "BTC")
            url = `https://api.blockchair.com/bitcoin/dashboards/transaction/${transactionId}`;

        // const validationResponse = await axios.get(url)

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not OK: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Display the JSON result
                validationResponse = data
            })
            .catch(error => {
                // document.getElementById('result').textContent = 'Error: ' + error.message;
                console.log("Error: ", error)
            });

        console.log("Response: ", validationResponse)

        //     , {
        //     user_address: walletAddress,
        //     amount_paid: cryptoAmount,          // in atomic units (piconeros) if your microservice expects that
        //     tx_hash: transactionId,       // transaction ID
        //     date: date
        //     // If your microservice also expects subaddress_index or other fields, add them here
        // });

        // const validationResponse = await axios.post(VALIDATION_SERVICE_URL, {
        //     user_address: walletAddress,
        //     amount_paid: cryptoAmount,          // in atomic units (piconeros) if your microservice expects that
        //     tx_hash: transactionId,       // transaction ID
        //     date: date
        //     // If your microservice also expects subaddress_index or other fields, add them here
        // });

        // The service we wrote previously returns JSON like:
        // { status: 'ok', validated: boolean, details: {...} }

        // const { validated, details } = validationResponse.data;


        // // If not validated, stop here
        // if (!validated) {
        //     return res.status(400).json({
        //         message: 'Transaction was not validated by the payment service.',
        //         details
        //     });
        // }

        // // If validated, proceed below
        // console.log("Transaction validated by the Monero service:", details);

    } catch (error) {
        console.error('Error calling validation service:', error.message);
        return res.status(500).json({
            message: 'Failed to call the Monero validation service.',
            error: error.message
        });
    }

    // 2) Proceed with DB logic if the transaction is validated
    try {
        // Check for duplicates
        const [rows] = await db.query(
            'SELECT * FROM purchases WHERE username = ? AND amount = ? AND transactionId = ?',
            [username, amount, transactionId]
        );

        console.log("Duplicate Check Result: ", rows);

        if (rows.length > 0) {
            // Duplicate found
            return res.status(409).json({ message: 'Duplicate purchase detected' });
        }

        // Start a DB transaction
        await db.query('START TRANSACTION');

        // Insert into "purchases" table
        await db.query(
            `INSERT INTO purchases 
                (username, userid, amount, reference_code, date, sessionID, transactionId, data, type, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                username,
                req.user.user_id,       // from authenticateToken middleware
                amount,
                uuidv4(),               // unique reference code
                date,
                session_id,
                transactionId,
                JSON.stringify(req.body),
                currency,
                "Pending"               // or "Validated" if you prefer
            ]
        );

        // If you need the recipient account, e.g. "SELECT * FROM accounts WHERE user_id = ?"
        // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [userId]);

        const message = `${currency} order: ${amount}`;

        // Insert a record in "transactions" table
        await db.query(
            `INSERT INTO transactions 
                (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                0,                // '0' if it's from system or external
                userId,
                amount,
                'purchase',
                'pending',
                "System",
                "You",
                message,
                uuidv4()
            ]
        );

        // Update user's spendable coin balance
        await db.query(
            'UPDATE accounts SET spendable = spendable + ? WHERE user_id = ?',
            [amount, req.user.user_id]
        );

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

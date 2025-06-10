const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const router = express.Router();

// URL of your Monero validation service
// e.g., 'http://localhost:3000/validate-payment' or wherever your microservice runs
const VALIDATION_SERVICE_URL = 'http://localhost:6000/validate-payment';

function validateTransaction(requestBody, validationData) {
    const {
        walletAddress,
        transactionId,
        cryptoAmount
    } = requestBody;

    // Convert the requested LTC amount to litoshis
    const requiredLitoshis = Math.floor(parseFloat(cryptoAmount) * 1e8);

    // Extract the transaction data from the validationData
    // The structure: validationData.data.<txid>.transaction and validationData.data.<txid>.outputs
    const txData = validationData.data && validationData.data[transactionId];
    if (!txData) {
        return { valid: false, message: "Transaction not found in API response." };
    }

    const { transaction, outputs } = txData;
    if (!transaction || !outputs) {
        return { valid: false, message: "Invalid transaction structure." };
    }

    // Check if transaction is confirmed (optional)
    // For Litecoin on Blockchair, a confirmed transaction should have a block_id.
    // If you want to ensure it has at least one confirmation, you can check if block_id is not null.
    if (!transaction.block_id) {
        return { valid: false, message: "Transaction not confirmed yet." };
    }

    // Look for an output that matches the user's walletAddress with enough funds
    const matchingOutput = outputs.find(output =>
        output.recipient === walletAddress && output.value >= requiredLitoshis
    );

    if (!matchingOutput) {
        return { valid: false, message: "No matching output found with the required amount." };
    }

    // If we reach this point, we found a valid output that matches the address and amount
    return { valid: true, message: "Transaction is valid and meets the required criteria." };
}


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

const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const router = express.Router();

router.post('/log-transaction', authenticateToken, async (req, res) => {
    /**
     * The data structure in req.body is something like:
     * {
     *   username,
     *   userId,
     *   amount,
     *   cryptoAmount,
     *   date,
     *   key,
     *   transactionId,
     *   currency,
     *   walletAddress,
     *   email,
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

    console.log("Cashapp Reloading amount:", amount, "coins" ,  " costing you: ", cryptoAmount," ", currency);
    console.log("Body:", req.body);

    try {
        // 1) Check if user has made a purchase in the last 12 hours
        //    This example assumes you have a 'created_at' column in 'purchases' that inserts automatically with the current timestamp
        //    Adjust the query if you track time differently in your schema
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                tempUID     // link to the purchase
            ]
        );

        // 6) Commit the transaction
        await db.query('COMMIT');

        return res.json({
            message: 'Wallet order logged successfully',
            ok: true
        });
    } catch (error) {
        // If there's an error, rollback the transaction
        await db.query('ROLLBACK');
        console.error('Error reloading wallet:', error);
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
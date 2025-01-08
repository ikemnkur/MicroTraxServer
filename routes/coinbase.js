
// Skip to content
// Navigation Menu

//     Copilot

// Copilot Chat
// Code Completion for Transaction Validation
// can you finish my code, I left some pseudo code for calutating the dates and the function for  ifLastPayDateWas24HoursAgo()
// Here is the code:
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
        // cryptoAmount,
        date,
        time,
        key,
        // transactionId,
        currency,
        walletAddress,  // fixed naming from "walletAdress"
        email,
        session_id
    } = req.body;

    console.log("Reloading amount: ", amount), " coins";
    console.log("Body: ", req.body);

    let transactionId = uuidv4() + time;

    // Helper function to check if the last payment date was 24 hours ago or more
    function ifLastPayDateWas24HoursAgo(dateString) {
        if (!dateString) return true; // If there's no date on file, treat it as if 24 hours have passed
        const now = new Date();
        const lastPay = new Date(dateString);
        const diffInMs = now - lastPay;
        const diffInHours = diffInMs / (1000 * 60 * 60);
        return diffInHours >= 24;
    }

    try {
         // Check for duplicates in the "purchases" table
         const [existingRows] = await db.query(
            'SELECT * FROM purchases WHERE username = ? AND amount = ?',
            [username, amount, transactionId]
        );
        console.log("Duplicate Check Result: ", existingRows);

        // If a duplicate is found, return an error
        if (existingRows.length > 0) {
            return res.status(409).json({ message: 'Duplicate purchase detected' });
        }

        // Retrieve the user's last payment date
        const [userRows] = await db.query(
            'SELECT paidLast FROM users WHERE username = ?',
            [username]
        );

        // If there's at least one record, check time difference
        let lastPayRecord = null;
        if (userRows.length > 0) {
            lastPayRecord = userRows[0].paidLast;
        }

        // If the last payment occurred less than 24 hours ago, handle that scenario
        if (!ifLastPayDateWas24HoursAgo(lastPayRecord)) {
            console.log("Duplicate Check Result: ", rows);
            return res.status(400).json({ message: 'A payment was made less than 24 hours ago.' });
        }


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
                (sender_account_id, recipient_account_id, amount, transaction_type, status, sending_user, receiving_user, message, reference_id) 
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

        // (Optional) Update user's paidLast field to the current time
        await db.query(
            'UPDATE users SET paidLast = ? WHERE username = ?',
            [new Date(), username]
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

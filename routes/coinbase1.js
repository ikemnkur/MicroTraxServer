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

    let transactionId = uuidv4() + time

    function ifLastPayDateWas24HoursAgo(date){
        now = new Date()
        delay = now - date 
        if (delay > "24 hours")
            return true
        else 
            return false
    }

    try {
        // Check for duplicates
        const [rows] = await db.query(
            'SELECT * FROM purchases WHERE username = ? AND amount = ? AND transactionId = ?',
            [username, amount, transactionId]
        );

        // Check for duplicates
        const lastPayDate = await db.query(
            'SELECT paidLast FROM users WHERE username = ?',
            [username,]
        );

        if(ifLastPayDateWas24HoursAgo(lastPayDate) = true )

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
                (username, userid, amount, reference_id, date, sessionID, transactionId, data, type, status) 
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

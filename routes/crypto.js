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

    // 1) Call the Monero validation service
    //    We'll pass relevant data. The microservice typically expects:
    //    tx_hash, user_address, amount_paid, date, etc.
    //    If your microservice uses subaddress indexes or additional fields,
    //    adapt accordingly.

    // let url;
    // let validationResponse;

    // try {
    //     // Assuming currency and transactionId are defined and available
    //     let url;

    //     if (currency === "LTC") {
    //         url = `https://api.blockchair.com/litecoin/dashboards/transaction/${transactionId}`;
    //     } else if (currency === "XMR") {
    //         url = `https://xmrchain.net/api/transaction/${transactionId}`;
    //     } else if (currency === "BTC") {
    //         url = `https://api.blockchair.com/bitcoin/dashboards/transaction/${transactionId}`;
    //     } else {
    //         throw new Error("Unsupported currency");
    //     }

    //     // Perform the fetch using await
    //     const response = await fetch(url);
    //     if (!response.ok) {
    //         throw new Error(`Network response was not OK: ${response.statusText}`);
    //     }

    //     const data = await response.json();

    //     console.log("Response: ", data.data);

    //     // If you need to store this in validationResponse or do something else with it:
    //     // const validationResponse = data;

    //     // The validationData would be the JSON response from the Blockchair API shown above.
    //     const validationData = data;

    //     // Call the function:
    //     const result = validateTransaction(req.body, validationData);
    //     console.log(result);

    //     // Proceed with additional logic using validationResponse
    //     // For example:
    //     // const validated = validationResponse.validated; // Adjust this based on the actual response structure
    //     // if (!validated) {
    //     //     return res.status(400).json({
    //     //         message: 'Transaction was not validated by the payment service.',
    //     //         details: validationResponse
    //     //     });
    //     // }

    //     // If validated, proceed
    //     // console.log("Transaction validated:", validationResponse);

    // } catch (error) {
    //     console.error('Error calling validation service:', error.message);
    //     return res.status(500).json({
    //         message: 'Failed to call the validation service.',
    //         error: error.message
    //     });
    // }


    // try {

    //     if (currency = "LTC")
    //         url = `https://api.blockchair.com/litecoin/dashboards/transaction/${transactionId}`;
    //     if (currency = "XMR")
    //         url = `https://xmrchain.net/api/transaction/${transactionId}`;
    //     if (currency = "BTC")
    //         url = `https://api.blockchair.com/bitcoin/dashboards/transaction/${transactionId}`;

    //     // const validationResponse = await axios.get(url)

    //     fetch(url)
    //         .then(response => {
    //             if (!response.ok) {
    //                 throw new Error(`Network response was not OK: ${response.statusText}`);
    //             }
    //             return response.json();
    //         })
    //         .then(data => {
    //             // Display the JSON result
    //             validationResponse = data
    //         })
    //         .catch(error => {
    //             // document.getElementById('result').textContent = 'Error: ' + error.message;
    //             console.log("Error: ", error)
    //         });

    //     console.log("Response: ", validationResponse)

    //     //     , {
    //     //     user_address: walletAddress,
    //     //     amount_paid: cryptoAmount,          // in atomic units (piconeros) if your microservice expects that
    //     //     tx_hash: transactionId,       // transaction ID
    //     //     date: date
    //     //     // If your microservice also expects subaddress_index or other fields, add them here
    //     // });

    //     // const validationResponse = await axios.post(VALIDATION_SERVICE_URL, {
    //     //     user_address: walletAddress,
    //     //     amount_paid: cryptoAmount,          // in atomic units (piconeros) if your microservice expects that
    //     //     tx_hash: transactionId,       // transaction ID
    //     //     date: date
    //     //     // If your microservice also expects subaddress_index or other fields, add them here
    //     // });

    //     // The service we wrote previously returns JSON like:
    //     // { status: 'ok', validated: boolean, details: {...} }

    //     // const { validated, details } = validationResponse.data;


    //     // // If not validated, stop here
    //     // if (!validated) {
    //     //     return res.status(400).json({
    //     //         message: 'Transaction was not validated by the payment service.',
    //     //         details
    //     //     });
    //     // }

    //     // // If validated, proceed below
    //     // console.log("Transaction validated by the Monero service:", details);

    // } catch (error) {
    //     console.error('Error calling validation service:', error.message);
    //     return res.status(500).json({
    //         message: 'Failed to call the Monero validation service.',
    //         error: error.message
    //     });
    // }

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

        let notificationMsg = `Your order of ${amount} coins via ${currency} has been logged and will be reviewed shortly. `

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

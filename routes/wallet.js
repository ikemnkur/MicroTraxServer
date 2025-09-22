const express = require('express');
const db = require('../config/db');
const axios = require('axios'); // Install axios: npm install axios

const authenticateToken = require('../middleware/auth');

const router = express.Router();
const { v4: uuidv4 } = require('uuid');

router.post('/stripe-reload', authenticateToken, async (req, res) => {
  const { username, amount, date, stripe, session_id, TRXdata } = req.body;
  const data = req.body;
  console.log("Reloading amount: ", amount);
  console.log("Session ID: ", session_id);

  let formdata = JSON.stringify(req.body)

  try {
    // Check for duplicates
    const [rows, fields] = await db.query(
      `
        SELECT * 
        FROM purchases
        WHERE 
          (username = ? AND amount = ? AND sessionID = ?)
          OR 
          (username = ? AND amount = ? AND transactionId = ?)
      `,
      [username, amount, session_id, username, amount, TRXdata.id]
    );

    console.log("Duplicate Check Result: ", rows);

    if (rows.length > 0) {
      // Duplicate found, send a 409 Conflict response
      return res.status(409).json({ message: 'Duplicate purchase detected' });
    }

    // Start a transaction
    await db.query('START TRANSACTION');



    // Insert into purchases table
    await db.query(
      'INSERT INTO purchases (username, userid, amount, stripe, reference_id, date, sessionID, type, status, transactionId, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, req.user.user_id, amount, stripe, uuidv4(), date, session_id, "Stripe", "Complete", TRXdata.id, JSON.stringify(TRXdata)]
    );

    // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.user_id]);

    try {
      if (currency == null)
        currency = "$USD"
    } catch (error) {
      currency = "$USD"
    }


    const message = `${currency} order: ${amount}`

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [0, req.user.user_id, amount, 'purchase', 'completed', "System", "You", message, uuidv4()]
    );


    // Update user's coin balance
    await db.query(
      'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
      [amount, req.user.user_id]
    );

    // Update user's spendable coin balance
    await db.query(
      'UPDATE accounts SET spendable = spendable + ? WHERE user_id = ?',
      [amount, req.user.user_id]
    );


    // Create Notification
    //  const { type, recipient_user_id, recipient_username, Nmessage, from_user, date } = req.body;
    //  console.log("New notification: ", Nmessage);

    // Fetch user details
    const [user] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );



    let notificationMsg = `Hoo-ray, Your Stripe purchase of ${amount} coins has been sumbitted, it will be reviewed and processed soon. !`

    try {
      const [result] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
    VALUES (?, ?, ?, ?, ?, ?)`,
        ["purchase-submitted", req.user.user_id, notificationMsg, "0", user.username, new Date()]
      );

      console.log("New notification successfully created:", notificationMsg);
      // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
    } catch (error) {
      console.error('Error creating notification:', error);
      // res.status(500).json({ message: 'Server error' });
    }

    // Commit the transaction
    await db.query('COMMIT');
    res.json({ message: 'Transaction successful', ok: true });
    // res.status(201).json({ message: 'Wallet reloaded successfully' });
  } catch (error) {
    // If there's an error, rollback the transaction
    await db.query('ROLLBACK');
    console.error('Error reloading wallet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Map for deposit wallet addresses - these are the addresses your system expects users to send funds to
const depositWalletAddressMap = {
  BTC: { address: 'qrzx04h0r25x5x232z5d2y37t2420p9x9sh5x58q67', blockchain: 'bitcoin-cash' }, // Example for BCH
  LTC: { address: 'ltc1qzx04hghmghmgh545456456t2420p9x9sh5x58q67', blockchain: 'litecoin' },
  SOL: { address: 'RiKRqrmqXeJdeKAciYuyaJj7STZnHMggfnnnngfnfs', blockchain: 'solana' },
  ETH: { address: '0xRiKRqrmqXeJdfbdfeKAciYuyaJj7STZnHMg6', blockchain: 'ethereum' },
  XMR: { address: '44X8AgosuXFCuRmBoDRc66Vw1FeCaL6vRiKRqrmqXeJdeKAciYuyaJj7STZnHMg7x8icHJL6M1hzeAPqSh8NSC1GGC9bkCp', blockchain: 'monero' },
  // Add other currencies and their corresponding Blockchair blockchain paths as needed
};

// --- Helper function to fetch all transactions for an address and filter by date ---
async function getAllTransactionsForLastDay(depositAddress, blockchain) {
  let allTransactions = [];
  let offset = 0;
  const limit = 100; // Max per Blockchair API request
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Get date 24 hours ago

  while (true) {
    const url = `https://api.blockchair.com/${blockchain}/dashboards/address/${depositAddress}?transaction_details=true&limit=${limit}&offset=${offset}`;
    try {
      const response = await axios.get(url);
      const data = response.data;

      // Ensure data and transactions exist and are in the expected format
      if (!data || !data.data || !data.data[depositAddress] || !data.data[depositAddress].transactions) {
        console.warn(`Blockchair API response for ${depositAddress} was incomplete or empty.`);
        break; // Exit if no transactions found or data structure is unexpected
      }

      const fetchedTransactions = data.data[depositAddress].transactions;

      if (fetchedTransactions.length === 0) {
        break; // No more transactions
      }

      // Filter transactions from the last 24 hours
      const recentTransactions = fetchedTransactions.filter(tx => {
        const txDate = new Date(tx.time); // Blockchair provides 'time' as a string in ISO format
        return txDate >= oneDayAgo;
      });

      allTransactions.push(...recentTransactions);

      // If we got fewer than the limit, it means we've reached the end of recent transactions
      if (fetchedTransactions.length < limit || recentTransactions.length < fetchedTransactions.length) {
        break;
      }

      offset += limit;
    } catch (error) {
      console.error(`Error fetching transactions from Blockchair for ${depositAddress}:`, error.message);
      // Handle API errors (e.g., rate limits, invalid address, network issues)
      // You might want to throw an error here or return an empty array, depending on your error handling strategy
      break;
    }
  }
  return allTransactions;
}


router.post('/crypto-reload', authenticateToken, async (req, res) => {
  const { username, userId, amount, date, key, transactionId, currency, walletAddress, email, session_id } = req.body;
  const data = req.body;

  console.log("Reloading amount: ", amount);
  console.log("userID: ", userId);
  console.log("Currency: ", currency);
  console.log("Submitted Transaction ID: ", transactionId);

  // Validate the provided currency and get the deposit address and blockchain slug
  const depositInfo = depositWalletAddressMap[currency];
  if (!depositInfo) {
    return res.status(400).json({ message: 'Unsupported cryptocurrency.' });
  }

  const { address: depositAddress, blockchain } = depositInfo;

  let transactionIsValid = false;
  let foundTransactionDetails = null; // To store details of the matched transaction

  try {
    // Check for duplicates in your database *before* fetching from the blockchain
    const [existingPurchases] = await db.query(
      'SELECT * FROM purchases WHERE username = ? AND amount = ? AND transactionId = ?',
      [username, amount, transactionId]
    );

    console.log("Duplicate Check Result: ", existingPurchases);

    if (existingPurchases.length > 0) {
      // Duplicate found, send a 409 Conflict response
      return res.status(409).json({ message: 'Duplicate purchase detected' });
    }

    // Fetch transactions from the blockchain for the last day
    const recentTransactions = await getAllTransactionsForLastDay(depositAddress, blockchain);

    // Validate the transaction against the fetched history
    // Find a transaction that matches the provided transactionId and amount (or close to it, considering fees)
    if (recentTransactions && recentTransactions.length > 0) {
      foundTransactionDetails = recentTransactions.find(tx => {
        // Blockchair's 'id' is the transaction hash.
        // It's crucial to correctly identify the received amount.
        // For simplicity, we check if the transaction includes the deposit address as a receiver
        // and if the sum of outputs to that address matches the expected amount.
        // This logic can be more complex depending on the blockchain and specific transaction structure.

        // Assuming Blockchair's 'destination' field in 'outputs' is the receiving address
        // And 'value_usd' or 'value' (in satoshis/wei etc.) needs to be checked against 'amount'
        const matchedOutputValue = tx.outputs.reduce((sum, output) => {
          if (output.recipient === depositAddress) {
            // Blockchair's 'value' is often in smallest units (satoshis, wei).
            // Need to convert 'amount' (from req.body) to the same unit for comparison.
            // For now, let's assume 'amount' is in the standard currency unit and Blockchair's 'value_usd' is available and reliable.
            // Or you'd need a conversion factor: e.g., tx.outputs[i].value / 10^8 for Bitcoin
            // For example, if 'amount' is USD and 'value_usd' is available:
            return sum + parseFloat(output.value_usd);
          }
          return sum;
        }, 0);

        // Check if the transaction ID matches and the amount is approximately correct
        // Using `toFixed` to handle floating-point precision issues
        return tx.id === transactionId && parseFloat(matchedOutputValue).toFixed(2) === parseFloat(amount).toFixed(2);
      });

      if (foundTransactionDetails) {
        transactionIsValid = true;
        console.log("Transaction confirmed on blockchain:", foundTransactionDetails.id);
      } else {
        console.log("Transaction not found or amount mismatch in recent history.");
      }
    }

    // Start a database transaction
    await db.query('START TRANSACTION');

    // Determine the status based on validation
    const transactionStatus = transactionIsValid ? "Pending" : "Rejected";

    // Insert into purchases table
    await db.query(
      'INSERT INTO purchases (username, userid, amount, reference_id, date, sessionID, transactionId, data, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, req.user.user_id, amount, uuidv4(), date, session_id, transactionId, JSON.stringify(data), currency, transactionStatus]
    );

    if (!transactionIsValid) {
      await db.query('COMMIT'); // Commit the purchase record even if rejected
      return res.status(409).json({ message: `${currency} Transaction of ${amount} to address: ${depositAddress} could not be confirmed on the blockchain.` });
    }

    // Proceed only if the transaction was confirmed on the blockchain
    const message = `${currency} order: ${amount}`;

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [0, userId, amount, 'purchase', 'pending', "System", "You", message, uuidv4()]
    );

    // Update user's spendable coin balance
    await db.query(
      'UPDATE accounts SET spendable = spendable + ? WHERE user_id = ?',
      [amount, req.user.user_id]
    );

    let notificationMsg = `Hoo-ray, Your ${currency} purchase of ${amount} coins has been submitted, it will be reviewed and processed soon. !`;

    try {
      const [notificationResult] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["purchase-submitted", req.user.user_id, notificationMsg, "0", username, new Date()]
      );
      console.log("New notification successfully created:", notificationMsg, "ID:", notificationResult.insertId);
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Decide if you want to fail the whole request or just log this error
    }

    // Commit the database transaction
    await db.query('COMMIT');
    res.json({ message: 'Wallet order logged and confirmed successfully', ok: true });

  } catch (error) {
    // If there's an error, rollback the transaction
    await db.query('ROLLBACK');
    console.error('Error processing crypto reload:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// // router.post('/crypto-reload', authenticateToken, async (req, res) => {
//   const { username, userId, amount, date, key, transactionId, currency, walletAdress, email, session_id } = req.body;
//   const data = req.body;
//   console.log("Reloading amount: ", amount);
//   console.log("userID: ", userId);

//    // Map for wallet addresses - examples for now
//    const walletAddressMap = {
//     BTC: 'qrzx04h0r25x5x232z5d2y37t2420p9x9sh5x58q67',
//     LTC: 'qrzx04hghmghmgh545456456t2420p9x9sh5x58q67',
//     SOL: 'RiKRqrmqXeJdeKAciYuyaJj7STZnHMggfnnnngfnfs',
//     ETH: 'sdfsdfRiKRqrmqXeJdfbdfeKAciYuyaJj7STZnHMg6',
//     XMR: '44X8AgosuXFCuRmBoDRc66Vw1FeCaL6vRiKRqrmqXeJdeKAciYuyaJj7STZnHMg7x8icHJL6M1hzeAPqSh8NSC1GGC9bkCp',
//   };


  
//   // todo modify this function to fetch the lastest transaction from the last day
//   function get_all_transactions(address, blockchain){
//     let = all_transactions = []
//     let = offset = 0
//     let limit = 100
//     while (True){
//         let url = `https://api.blockchair.com/${blockchain}/dashboards/address/${address}?transaction_details=true&limit=${limit}&offset=${offset}`
//         response = requests.get(url)
//         data = response.json()

//         if (data['data'][address]['transactions']){
//           all_transactions.extend(data['data'][address]['transactions'])
//             offset += limit
//         }
//         else{
//           // # If no transactions are returned, we have reached the end.
//             break
//         }
            
            
//     return all_transactions
//     }
      
//   }

//   let dayTransacations = get_all_transactions(walletAdress,currency)
//   transactionValid = false;

//   // Todo fix this function validate if the walletAdress and other transaction details in the req.body obj have been sen to on of the address in walletAddressMap[currency])
//   function validateMutualTransactions (){
//     if (dayTransacations['data'][address]['transactions'].includes(walletAddressMap[currency]))
//     {
//       transactionValid = true;
//     }
//   }
  
//   validateMutualTransactions()

//   try {
//     // Check for duplicates
//     const [rows, fields] = await db.query(
//       'SELECT * FROM purchases WHERE username = ? AND amount = ? AND transactionId = ?',
//       [username, amount, transactionId]
//     );

//     console.log("Duplicate Check Result: ", rows);

//     if (rows.length > 0) {
//       // Duplicate found, send a 409 Conflict response
//       return res.status(409).json({ message: 'Duplicate purchase detected' });
//     }

//     // Start a transaction
//     await db.query('START TRANSACTION');

//     // Insert into purchases table
//     await db.query(
//       'INSERT INTO purchases (username, userid, amount, reference_id, date, sessionID, transactionId, data, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
//       [username, req.user.user_id, amount, uuidv4(), date, session_id, transactionId, JSON.stringify(data), currency, !transactionValid ? "Rejected":"Pending"]
//     );

//     // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [userId]);

//       //if transaction can be validated cancel process
//     if (!transactionValid) {
//       await db.query('COMMIT');
//       return res.status(409).json({ message: `${currency} Transaction of ${amount} to address: ${walletAddressMap[currency]} could not be confirmed.` });
//     }
//     const message = `${currency} order: ${amount}`

//     await db.query(
//       'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
//       [0, userId, amount, 'purchase', 'pending', "System", "You", message, uuidv4()]
//     );

//     // Update user's spendable coin balance
//     await db.query(
//       'UPDATE accounts SET spendable = spendable + ? WHERE user_id = ?',
//       [amount, req.user.user_id]
//     );

//     // Create Notification
//     //  const { type, recipient_user_id, recipient_username, Nmessage, from_user, date } = req.body;
//     //  console.log("New notification: ", Nmessage);

//     // Fetch user details
//     const [user] = await db.query(
//       'SELECT * FROM users WHERE username = ?',
//       [username]
//     );





//     let notificationMsg = `Hoo-ray, Your ${currency} purchase  of ${amount} coins has been sumbitted, it will be reviewed and processed soon. !`

//     try {
//       const [result] = await db.query(
//         `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
//     VALUES (?, ?, ?, ?, ?, ?)`,
//         ["purchase-submitted", req.user.user_id, notificationMsg, "0", username, new Date()]
//       );

//       console.log("New notification successfully created:", notificationMsg);
//       // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
//     } catch (error) {
//       console.error('Error creating notification:', error);
//       // res.status(500).json({ message: 'Server error' });
//     }



//     // Commit the transaction
//     await db.query('COMMIT');
//     res.json({ message: 'Wallet order logged successfully', ok: true });
//   } catch (error) {
//     // If there's an error, rollback the transaction
//     await db.query('ROLLBACK');
//     console.error('Error reloading wallet:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// router.get('/', authenticateToken, async (req, res) => {
//   try {

//     let user_id = req.params.ud.user_id
//     console.log("user_id: " , req.body)

//     // const [walletData] = await db.query(
//     //   `SELECT a.balance, at.name as accountTier, at.daily_transaction_limit, at.spendable, at.redeemable,
//     //    FROM accounts a
//     //    JOIN user_tiers ut ON a.user_id = ut.user_id
//     //    JOIN account_tiers at ON ut.tier_id = at.id
//     //    WHERE a.user_id = ? AND ut.end_date IS NULL`,
//     //   [req.user.user_id]
//     // );

//     // const [walletData] = await db.query(
//     //   `SELECT 
//     //      a.balance, 
//     //      a.spendable, 
//     //      a.redeemable,
//     //      at.name AS accountTier, 
//     //      at.daily_transaction_limit

//     //    FROM accounts a
//     //    JOIN user_tiers ut ON a.user_id = ut.user_id
//     //    JOIN account_tiers at ON ut.tier_id = at.id
//     //    WHERE a.user_id = ? AND ut.end_date IS NULL`,
//     //   [req.user.user_id]
//     // );


//     const [walletData] = await db.query(
//       `SELECT 
//          a.balance, 
//          a.spendable, 
//          a.redeemable,      
//        WHERE a.user_id = ?`,
//       [user_id]
//     );



//     if (walletData.length === 0) {
//       return res.status(404).json({ message: 'Wallet data not found' });
//     }
//     console.log("Wallet Data: ", walletData)
//     res.json(walletData[0]);
//   } catch (error) {
//     console.error('Error fetching wallet data:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.get('/', authenticateToken, async (req, res) => {
  try {

    console.log("Received user_id:", req.user.user_id);

    const [walletData] = await db.query(
      `SELECT 
         a.balance, 
         a.spendable, 
         a.redeemable
       FROM accounts a
       WHERE a.user_id = ?`,
      [req.user.user_id]
    );

    if (walletData.length === 0) {
      return res.status(404).json({ message: 'Wallet data not found' });
    }

    console.log("Wallet Data: ", walletData);
    res.json(walletData[0]);
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.body;
    console.log("Received user_id:", req.user.user_id);

    const [walletData] = await db.query(
      `SELECT 
         a.balance, 
         a.spendable, 
         a.redeemable
       FROM accounts a
       WHERE a.user_id = ?`,
      [req.user.user_id]
    );

    if (walletData.length === 0) {
      return res.status(404).json({ message: 'Wallet data not found' });
    }

    console.log("Wallet Data: ", walletData);
    res.json(walletData[0]);
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.post('/withdraw', authenticateToken, async (req, res) => {
  const { username, amount, date, method } = req.body;
  console.log("Withdraw Data: ", req.body)
  const data = req.body;
  console.log('req.user:', req.user);
  try {

    // / Fetch user data along with account ID
    const [userData] = await db.query(
      `SELECT u.user_id AS userId, a.id AS accountId, a.balance, u.accountTier, a.spendable, a.redeemable
       FROM users u
       LEFT JOIN accounts a ON u.user_id = a.user_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );
    console.log('User Data:', userData);

    if (userData[0].redeemable < amount) {
      console.log("Insuffiecent redeemable balance for withdraw");
      console.error('Error purchase data:', error);
      return res.status(500).json({ message: 'Server error: Insufficent redeemable balance for withdraw' });
    }

    let txid = uuidv4()

    await db.query(
      'INSERT INTO withdraws (username, userid, amount, reference_id, method, formdata) VALUES (?, ?, ?, ?, ?, ?)',
      [username, req.user.user_id, amount, txid, method, JSON.stringify(data)]
    );

    // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.user_id]);

    const message = `${method} order: ${amount}`

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [0, req.user.user_id, amount, 'withdraw', 'pending', "You", "System", message, txid]
    );


    // Update user's coin balance
    await db.query(
      'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
      [amount, req.user.user_id]
    );

    // Update user's coin redeemable balance
    await db.query(
      'UPDATE accounts SET redeemable = redeemable - ? WHERE user_id = ?',
      [amount, req.user.user_id]
    );

    // Create Notification
    //  const { type, recipient_user_id, recipient_username, Nmessage, from_user, date } = req.body;
    //  console.log("New notification: ", Nmessage);

    // Fetch user details
    const [user] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );



    let notificationMsg = `Hoo-ray, Your withdraw of ${amount} coins has been sumbitted, it will be reviewed and processed soon. !`

    try {
      const [result] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
    VALUES (?, ?, ?, ?, ?, ?)`,
        ["withdraw-submitted", req.user.user_id, notificationMsg, "0", username, new Date()]
      );

      console.log("New notification successfully created:", notificationMsg);
      // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
    } catch (error) {
      console.error('Error creating notification:', error);
      // res.status(500).json({ message: 'Server error' });
    }

    // res.status(201).json({ message: 'Content added successfully', ok: true });
    // res.json({ message: 'Transaction successful' });

    // Send the success response one time only
    return res.status(201).json({ message: 'Content added successfully', ok: true, details: 'Transaction successful' });
  } catch (error) {
    console.error('Error post purchase data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/convert', authenticateToken, async (req, res) => {
  const { username, amount, date, method, dashboardData } = req.body;
  console.log("Convert Data: ", req.body)
  // dashboardData = {"balance":361796,"spendable":501041,"redeemable":53546,"accountTier":3,"dailyLimit":25,"dailyCoinLimit":1000,"transactionsLast24Hours":1,"transactionsToday":1,"totalAmountToday":50000,"sentTransactions":0,"receivedTransactions":1,"totalAmountSentLast24Hours":0,"totalAmountReceivedLast24Hours":50000,"totalAmountSentToday":0,"totalAmountReceivedToday":50000}
  const data = req.body;
  console.log('req.user:', req.user);

  // Define daily limits based on account tier
  const dailyLimits = {
    1: 5,    // Basic
    2: 10,    // Standard
    3: 25,   // Premium
    4: 50,   // Gold
    5: 100,  // Platinum
    6: 200,  // Diamond
    7: 500  // Ultimate
  };

  // Define daily limits based on account tier
  const dailyCoinLimits = {
    1: 100,    // Basic
    2: 500,    // Standard
    3: 1000,   // Premium
    4: 5000,   // Gold
    5: 10000,  // Platinum
    6: 50000,  // Diamond
    7: 100000  // Ultimate
  };

  let dailyLimit = dailyLimits[dashboardData.accountTier] ?? 100; // Default to 100 if not found
  let dailyCoinLimit = dailyCoinLimits[dashboardData.accountTier] ?? 100; // Default to 100 if not found
  let totalAmountReceivedLast24Hours = dashboardData.totalAmountReceivedLast24Hours ? parseFloat(dashboardData.totalAmountReceivedLast24Hours) : 0;
  let receivedTransactions = dashboardData.receivedTransactions || 0;

  try {



    // / Fetch user data along with account ID
    const [userData] = await db.query(
      `SELECT u.user_id AS userId, a.id AS accountId, a.balance, u.accountTier, a.spendable, a.redeemable
       FROM users u
       LEFT JOIN accounts a ON u.user_id = a.user_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );
    console.log('User Data:', userData);


    // Check daily coin limit 
    if (totalAmountReceivedLast24Hours + amount > dailyCoinLimit) {
      console.log("Daily coin limit would be exceeded");
      console.error('Error conversion data');
      return res.status(500).json({ message: 'Server error: Daily coin limit exceeded' });
    }

    // Check daily transaction limit
    if (receivedTransactions + 1 > dailyLimit) {
      console.log("Daily transaction number limit would be exceeded");
      console.error('Error conversion data');
      return res.status(500).json({ message: 'Server error: Daily limit exceeded' });
    }

    if (dashboardData.dailyCoinLimit < amount) {
      console.log("Amount is over the daily coin limit for conversion");
      console.error('Error conversion data');
      return res.status(500).json({ message: 'Server error: Insufficient daily coin limit for conversion' });
    }

    if (method == "spend")
      if (userData[0].redeemable < amount) {
        console.log("Insufficient redeemable balance for conversion");
        console.error('Error conversion data');
        return res.status(500).json({ message: 'Server error: Insufficient redeemable balance for withdraw' });
      }

    if (method == "redeem")
      // console.log("User Data:", userData);
      if (userData[0].spendable < amount) {
        console.log("Insuffiecent spendable balance for conversion");
        console.error('Error coversion data');
        return res.status(500).json({ message: 'Server error: Insuffiecent redeemable balance for withdraw' });
      }

    await db.query(
      'INSERT INTO conversions (username, userid, amount, reference_id, method, formdata) VALUES (?, ?, ?, ?, ?, ?)',
      [username, req.user.user_id, amount, uuidv4(), method, JSON.stringify(data)]
    );

    // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.user_id]);

    const message = `${method} convert: ${amount}`

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [0, req.user.user_id, amount, 'convert', 'Completed', "You", "System", message, uuidv4()]
    );
    let feeamount = 0;
    if (method == "redeem")
      feeamount = Math.ceil(amount * 0.1)
    else
      feeamount = Math.ceil(amount * 0.05)

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [0, req.user.user_id, feeamount, 'fee', 'Completed', "You", "System", message, uuidv4()]
    );

    if (method == "spend") {
      // // Update user's coin balance
      // await db.query(
      //   'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
      //   [amount, req.user.user_id]
      // );

      // Update user's coin redeemable balance
      await db.query(
        'UPDATE accounts SET spendable = spendable + ? WHERE user_id = ?',
        [amount, req.user.user_id]
      );

      await db.query(
        'UPDATE accounts SET redeemable = redeemable - ? WHERE user_id = ?',
        [amount, req.user.user_id]
      );
      // charge fee to user's coin redeemable balance
      await db.query(
        'UPDATE accounts SET redeemable = redeemable - ? WHERE user_id = ?',
        [feeamount, req.user.user_id]
      );
    }

    if (method == "redeem") {
      // Update user's coin balance
      // await db.query(
      //   'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
      //   [amount, req.user.user_id]
      // );

      // Update user's coin redeemable balance
      await db.query(
        'UPDATE accounts SET redeemable = redeemable + ? WHERE user_id = ?',
        [amount, req.user.user_id]
      );

      // Update user's coin spendable balance
      await db.query(
        'UPDATE accounts SET spendable = spendable - ? WHERE user_id = ?',
        [amount, req.user.user_id]
      );

 // Charge a fee to user's coin spendable balance
      await db.query(
        'UPDATE accounts SET spendable = spendable - ? WHERE user_id = ?',
        [feeamount, req.user.user_id]
      );



    }


    // Create Notification
    //  const { type, recipient_user_id, recipient_username, Nmessage, from_user, date } = req.body;
    //  console.log("New notification: ", Nmessage);

    // Fetch user details
    const [user] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );



    let notificationMsg = `Hoo-ray, Your conversion of ${amount} coins has been processed!`

    try {
      const [result] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
    VALUES (?, ?, ?, ?, ?, ?)`,
        ["purchase-confirmed", req.user.user_id, notificationMsg, "0", user.username, new Date()]
      );

      console.log("New notification successfully created:", notificationMsg);
      // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
    } catch (error) {
      console.error('Error creating notification:', error);
      // res.status(500).json({ message: 'Server error' });
    }

    // res.status(201).json({ message: 'Content added successfully', ok: true });
    // res.json({ message: 'Transaction successful' });

    // Send the success response one time only
    return res.status(201).json({ message: 'Content added successfully', ok: true, details: 'Transaction successful' });
  } catch (error) {
    console.error('Error post purchase data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
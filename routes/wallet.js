const express = require('express');
const db = require('../config/db');
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

router.post('/crypto-reload', authenticateToken, async (req, res) => {
  const { username, userId, amount, date, key, transactionId, currency, walletAdress, email, session_id } = req.body;
  const data = req.body;
  console.log("Reloading amount: ", amount);
  console.log("userID: ", userId);

  try {
    // Check for duplicates
    const [rows, fields] = await db.query(
      'SELECT * FROM purchases WHERE username = ? AND amount = ? AND transactionId = ?',
      [username, amount, transactionId]
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
      'INSERT INTO purchases (username, userid, amount, reference_id, date, sessionID, transactionId, data, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, req.user.user_id, amount, uuidv4(), date, session_id, transactionId, JSON.stringify(data), currency, "Pending"]
    );

    // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [userId]);

    const message = `${currency} order: ${amount}`

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, receiving_user, sending_user, message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [0, userId, amount, 'purchase', 'pending', "System", "You", message, uuidv4()]
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



    let notificationMsg = `Hoo-ray, Your ${currency} purchase  of ${amount} coins has been sumbitted, it will be reviewed and processed soon. !`

    try {
      const [result] = await db.query(
        `INSERT INTO notifications (type, recipient_user_id, message, \`from\`, recipient_username, date)
    VALUES (?, ?, ?, ?, ?, ?)`,
        ["purchase-submitted", req.user.user_id, notificationMsg, "0", username, new Date()]
      );

      console.log("New notification successfully created:", notificationMsg);
      // res.status(201).json({ message: 'Notification created successfully', id: result.insertId });
    } catch (error) {
      console.error('Error creating notification:', error);
      // res.status(500).json({ message: 'Server error' });
    }



    // Commit the transaction
    await db.query('COMMIT');
    res.json({ message: 'Wallet order logged successfully', ok: true });
  } catch (error) {
    // If there's an error, rollback the transaction
    await db.query('ROLLBACK');
    console.error('Error reloading wallet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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
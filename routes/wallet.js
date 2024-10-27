const express = require('express');
const db = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const { v4: uuidv4 } = require('uuid');

router.post('/stripe-reload', authenticateToken, async (req, res) => {
  const { username, amount, date, stripe, session_id } = req.body;
  const data = req.body;
  console.log("Reloading amount: ", amount);
  console.log("Session ID: ", session_id);
  
  try {
    // Check for duplicates
    const [rows, fields] = await db.query(
      'SELECT * FROM purchases WHERE username = ? AND amount = ? AND sessionID = ?',
      [username, amount, session_id]
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
      'INSERT INTO purchases (username, userid, amount, reference_code, date, sessionID, formdata, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, req.user.id, amount, uuidv4(), date, session_id, formdata, "stripe", "Complete"]
    );

    // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.id]);

    const message = `${currency} order: ${amount}`

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, recieving_user, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ["ACC00000000000", req.user.id, amount, 'purchase', 'complete', username, message]
    );


    // Update user's coin balance
    await db.query(
      'UPDATE accounts SET balance = balance + ? WHERE user_id = ?',
      [amount, req.user.id]
    );

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
      'INSERT INTO purchases (username, userid, amount, reference_code, date, sessionID, transactionId, data, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, req.user.id, amount, uuidv4(),  date, session_id, transactionId, JSON.stringify(data), currency, "Pending"]
    );

    // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [userId]);

    const message = `${currency} order: ${amount}`

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, recieving_user, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [0, userId, amount, 'purchase', 'pending', username, message]
    );

    // Commit the transaction
    await db.query('COMMIT');
    res.json({ message: 'Wallet order logged successfully' , ok: true});
  } catch (error) {
    // If there's an error, rollback the transaction
    await db.query('ROLLBACK');
    console.error('Error reloading wallet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    // const [walletData] = await db.query(
    //   `SELECT a.balance, at.name as accountTier, at.daily_transaction_limit, at.spendable, at.redeemable,
    //    FROM accounts a
    //    JOIN user_tiers ut ON a.user_id = ut.user_id
    //    JOIN account_tiers at ON ut.tier_id = at.id
    //    WHERE a.user_id = ? AND ut.end_date IS NULL`,
    //   [req.user.id]
    // );

    const [walletData] = await db.query(
      `SELECT 
         a.balance, 
         a.spendable, 
         a.redeemable,
         at.name AS accountTier, 
         at.daily_transaction_limit
         
       FROM accounts a
       JOIN user_tiers ut ON a.user_id = ut.user_id
       JOIN account_tiers at ON ut.tier_id = at.id
       WHERE a.user_id = ? AND ut.end_date IS NULL`,
      [req.user.id]
    );
    

    if (walletData.length === 0) {
      return res.status(404).json({ message: 'Wallet data not found' });
    }

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
  try {

    await db.query(
      'INSERT INTO withdraws (username, userid, amount, reference_code, method, formdata) VALUES (?, ?, ?, ?, ?, ?)',
      [username, req.user.id, amount, uuidv4(), method, JSON.stringify(data)]
    );

    // const [recipientAccount] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [req.user.id]);

    const message = `${method} order: ${amount}`

    await db.query(
      'INSERT INTO transactions (sender_account_id, recipient_account_id, amount, transaction_type, status, recieving_user, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ["ACC00000000000", req.user.id, amount, 'withdraw', 'pending', username, message]
    );


    // Update user's coin balance
    await db.query(
      'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
      [amount, req.user.id]
    );
    res.status(201).json({ message: 'Content added successfully', ok: true });
    res.json({ message: 'Transaction successful' });
  } catch (error) {
    console.error('Error post purchase data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;